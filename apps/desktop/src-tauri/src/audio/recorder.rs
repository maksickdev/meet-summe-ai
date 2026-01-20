use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use mp3lame_encoder::Bitrate;
use ringbuf::traits::{Consumer, Producer, Split};

use crate::audio::device;
use crate::audio::writer::Mp3Writer;

#[derive(Debug, Clone, serde::Serialize)]
pub struct RecordingResult {
    pub audio_path: String,
    pub system_audio_path: Option<String>,
    pub merged_audio_path: Option<String>,
    pub sample_rate: u32,
    pub channels: u16,
    pub duration_ms: u64,
}

pub struct RecordingSession {
    paused: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
    started_at: Instant,
    paused_accum_ms: Arc<Mutex<u64>>,
    pause_started_at: Arc<Mutex<Option<Instant>>>,
    sample_rate: u32,
    channels: u16,
    audio_path: PathBuf,
    system_audio_path: Option<PathBuf>,
    merged_audio_path: Option<PathBuf>,
    threads: Vec<JoinHandle<Result<(), String>>>,
}

impl RecordingSession {
    pub fn start(
        audio_path: PathBuf,
        system_audio_path: Option<PathBuf>,
        merged_audio_path: Option<PathBuf>,
        mic_device_name: Option<String>,
        quality_mode: &str,
    ) -> Result<Self, String> {
        let (sample_rate, channels, bitrate) = if quality_mode == "size" {
            (16_000, 1u16, Bitrate::Kbps32)
        } else {
            (48_000, 2u16, Bitrate::Kbps64)
        };

        // Buffer about ~5 seconds at 48kHz (max rate). Writer drains it continuously.
        let rb_system = ringbuf::HeapRb::<f32>::new(240_000);
        let rb_mic = ringbuf::HeapRb::<f32>::new(240_000);
        let (prod_system, cons_system) = rb_system.split();
        let (prod_mic, cons_mic) = rb_mic.split();

        let paused = Arc::new(AtomicBool::new(false));
        let stop = Arc::new(AtomicBool::new(false));
        let started_at = Instant::now();
        let paused_accum_ms = Arc::new(Mutex::new(0u64));
        let pause_started_at = Arc::new(Mutex::new(None::<Instant>));

        let writer_thread = {
            let paused = Arc::clone(&paused);
            let stop = Arc::clone(&stop);
            let audio_path = audio_path.clone();
            let system_audio_path = system_audio_path.clone();
            let merged_audio_path = merged_audio_path.clone();
            let paused_accum_ms = Arc::clone(&paused_accum_ms);
            let pause_started_at = Arc::clone(&pause_started_at);
            std::thread::spawn(move || {
                writer_loop(
                    audio_path,
                    system_audio_path,
                    merged_audio_path,
                    sample_rate,
                    channels,
                    bitrate,
                    cons_system,
                    cons_mic,
                    paused,
                    stop,
                    paused_accum_ms,
                    pause_started_at,
                )
            })
        };

        let mut threads: Vec<JoinHandle<Result<(), String>>> = vec![writer_thread];

        // System audio capture (native Rust) via qruhear.
        let system_thread = {
            let paused = Arc::clone(&paused);
            let stop = Arc::clone(&stop);
            std::thread::spawn(move || system_capture_loop(prod_system, sample_rate, paused, stop))
        };
        threads.push(system_thread);

        // Microphone capture via cpal
        let mic_thread = {
            let paused = Arc::clone(&paused);
            let stop = Arc::clone(&stop);
            std::thread::spawn(move || {
                mic_capture_loop(prod_mic, mic_device_name, sample_rate, paused, stop)
            })
        };
        threads.push(mic_thread);

        Ok(Self {
            paused,
            stop,
            started_at,
            paused_accum_ms,
            pause_started_at,
            sample_rate,
            channels,
            audio_path,
            system_audio_path,
            merged_audio_path,
            threads,
        })
    }

    pub fn pause(&self) -> Result<(), String> {
        if self.paused.swap(true, Ordering::SeqCst) {
            return Ok(());
        }
        let mut guard = self
            .pause_started_at
            .lock()
            .map_err(|_| "Pause mutex poisoned.".to_string())?;
        *guard = Some(Instant::now());
        Ok(())
    }

    pub fn resume(&self) -> Result<(), String> {
        if !self.paused.swap(false, Ordering::SeqCst) {
            return Ok(());
        }
        let mut pause_start = self
            .pause_started_at
            .lock()
            .map_err(|_| "Pause mutex poisoned.".to_string())?;
        if let Some(t0) = pause_start.take() {
            let mut accum = self
                .paused_accum_ms
                .lock()
                .map_err(|_| "Pause mutex poisoned.".to_string())?;
            *accum += t0.elapsed().as_millis() as u64;
        }
        Ok(())
    }

    pub fn stop(mut self) -> Result<RecordingResult, String> {
        self.stop.store(true, Ordering::SeqCst);
        for t in self.threads.drain(..) {
            // Best-effort join: return first error if any.
            if let Ok(Err(e)) = t.join() {
                return Err(e);
            }
        }
        let paused_ms = self
            .paused_accum_ms
            .lock()
            .map_err(|_| "Pause mutex poisoned.".to_string())?
            .to_owned();
        let duration_ms = self.started_at.elapsed().as_millis() as u64 - paused_ms;
        Ok(RecordingResult {
            audio_path: self.audio_path.to_string_lossy().to_string(),
            system_audio_path: self
                .system_audio_path
                .map(|p| p.to_string_lossy().to_string()),
            merged_audio_path: self
                .merged_audio_path
                .map(|p| p.to_string_lossy().to_string()),
            sample_rate: self.sample_rate,
            channels: self.channels,
            duration_ms,
        })
    }
}

// Simple nearest-neighbor resampler logic state
struct NnResampler {
    accum: u32,
}

impl NnResampler {
    fn new() -> Self {
        Self { accum: 0 }
    }

    // Returns true if current sample should be emitted
    fn should_emit(&mut self, source_rate: u32, target_rate: u32) -> bool {
        if source_rate == target_rate {
            return true;
        }
        self.accum += target_rate;
        if self.accum >= source_rate {
            self.accum -= source_rate;
            true
        } else {
            false
        }
    }
}

fn system_capture_loop(
    prod_system: impl Producer<Item = f32> + Send + 'static,
    target_sample_rate: u32,
    paused: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
) -> Result<(), String> {
    use qruhear::{rucallback, RUBuffers, RUHear};

    let producer = Arc::new(Mutex::new(prod_system));
    let stop_cb = Arc::clone(&stop);
    let paused_cb = Arc::clone(&paused);
    
    let detected_sample_rate = Arc::new(Mutex::new(None::<u32>));
    let detected_sample_rate_cb = Arc::clone(&detected_sample_rate);
    
    // Resampler state
    let resampler = Arc::new(Mutex::new(NnResampler::new()));
    
    let callback = move |audio_buffers: RUBuffers| {
        if stop_cb.load(Ordering::SeqCst) || paused_cb.load(Ordering::SeqCst) {
            return;
        }
        if audio_buffers.is_empty() {
            return;
        }
        
        let frames = audio_buffers[0].len();
        
        // Detect sample rate on first callback
        let mut source_rate = 48000;
        if let Ok(mut guard) = detected_sample_rate_cb.lock() {
            if guard.is_none() {
                // qruhear default assumption
                *guard = Some(48000); 
                eprintln!("[System Audio] Assuming source rate 48000 Hz");
            }
            source_rate = guard.unwrap_or(48000);
        }

        let mut res = resampler.lock().unwrap();

        // Downmix to mono by averaging all channels.
        for i in 0..frames {
            let mut sum = 0.0f32;
            for ch in &audio_buffers {
                if let Some(s) = ch.get(i) {
                    sum += *s;
                }
            }
            let v = sum / (audio_buffers.len() as f32);

            if res.should_emit(source_rate, target_sample_rate) {
                 if let Ok(mut p) = producer.lock() {
                     let _ = p.try_push(v);
                 }
            }
        }
    };

    let callback = rucallback!(callback);
    let mut ruhear = RUHear::new(callback);
    ruhear
        .start()
        .map_err(|e| format!("Failed to start system audio capture: {e}"))?;

    eprintln!("[System Audio] Capture thread started");

    while !stop.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_millis(50));
    }
    
    eprintln!("[System Audio] Stopping capture");
    ruhear
        .stop()
        .map_err(|e| format!("Failed to stop system audio capture: {e}"))?;
    Ok(())
}

fn mic_capture_loop(
    prod_mic: impl Producer<Item = f32> + Send + 'static,
    mic_device_name: Option<String>,
    target_sample_rate: u32,
    paused: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
) -> Result<(), String> {
    let host = cpal::default_host();
    let device = if let Some(name) = mic_device_name.as_deref() {
        device::find_input_device_by_name(name)?
    } else {
        host.default_input_device()
            .ok_or_else(|| "No default input device available.".to_string())?
    };

    let (config, sample_format) = select_mic_config(&device, target_sample_rate)?;
    let stream_sample_rate = config.sample_rate.0;
    let channels = config.channels as usize;
    
    eprintln!(
        "[Microphone] Starting capture: {}Hz (target {}), {} channels, format: {:?}",
        stream_sample_rate, target_sample_rate, channels, sample_format
    );

    let prod = Arc::new(Mutex::new(prod_mic));
    let err_fn = |err| eprintln!("[Microphone] cpal input stream error: {err}");

    let stop_f32 = Arc::clone(&stop);
    let paused_f32 = Arc::clone(&paused);
    let stop_i16 = Arc::clone(&stop);
    let paused_i16 = Arc::clone(&paused);
    let stop_u16 = Arc::clone(&stop);
    let paused_u16 = Arc::clone(&paused);
    
    let resampler = Arc::new(Mutex::new(NnResampler::new()));

    // Callback wrapper to handle resampling if needed
    let mut handle_sample = {
        let prod = Arc::clone(&prod);
        let resampler = Arc::clone(&resampler);
        move |s: f32| {
             let mut res = resampler.lock().unwrap();
             if res.should_emit(stream_sample_rate, target_sample_rate) {
                 if let Ok(mut p) = prod.lock() {
                    let _ = p.try_push(s);
                 }
             }
        }
    };

    let stream = match sample_format {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &config,
            move |data: &[f32], _| {
                write_mic_samples(data, channels, &stop_f32, &paused_f32, &mut handle_sample, |x| x)
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::I16 => device.build_input_stream(
            &config,
            move |data: &[i16], _| {
                write_mic_samples(data, channels, &stop_i16, &paused_i16, &mut handle_sample, |x| (x as f32) / (i16::MAX as f32))
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::U16 => device.build_input_stream(
            &config,
            move |data: &[u16], _| {
                write_mic_samples(data, channels, &stop_u16, &paused_u16, &mut handle_sample, |x| (x as f32 - 32768.0) / 32768.0)
            },
            err_fn,
            None,
        ),
        _ => return Err("Unsupported microphone sample format.".to_string()),
    }
    .map_err(|e| format!("Failed to build input stream: {e}"))?;

    stream
        .play()
        .map_err(|e| format!("Failed to start input stream: {e}"))?;

    eprintln!("[Microphone] Capture stream started");

    while !stop.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_millis(50));
    }
    
    eprintln!("[Microphone] Stopping capture");
    drop(stream);
    Ok(())
}

fn write_mic_samples<T, F, C>(
    data: &[T],
    channels: usize,
    stop: &Arc<AtomicBool>,
    paused: &Arc<AtomicBool>,
    callback: &mut C,
    convert: F,
) where
    T: Copy,
    F: Fn(T) -> f32,
    C: FnMut(f32),
{
    if stop.load(Ordering::SeqCst) || paused.load(Ordering::SeqCst) {
        return;
    }
    
    if channels <= 1 {
        for s in data {
            callback(convert(*s));
        }
    } else {
        // Downmix interleaved multi-channel input to mono for processing
        for frame in data.chunks(channels) {
            let mut sum = 0.0f32;
            for s in frame {
                sum += convert(*s);
            }
            callback(sum / (channels as f32));
        }
    }
}

fn select_mic_config(
    device: &cpal::Device,
    desired_rate: u32,
) -> Result<(cpal::StreamConfig, cpal::SampleFormat), String> {
    let default = device
        .default_input_config()
        .map_err(|e| format!("Failed to get default input config: {e}"))?;
    let default_format = default.sample_format();

    // Try to find a config that supports our desired sample rate
    if let Ok(configs) = device.supported_input_configs() {
        for cfg in configs {
            let min = cfg.min_sample_rate().0;
            let max = cfg.max_sample_rate().0;
            if desired_rate >= min && desired_rate <= max {
                let config = cpal::StreamConfig {
                    channels: cfg.channels(),
                    sample_rate: cpal::SampleRate(desired_rate),
                    buffer_size: cpal::BufferSize::Default,
                };
                return Ok((config, cfg.sample_format()));
            }
        }
    }

    // Fallback: return default config natively (likely 48k or 44.1k)
    // We let our software resampler handle the rate conversion.
    Ok((default.config(), default_format))
}

fn writer_loop(
    mic_path: PathBuf,
    sys_path: Option<PathBuf>,
    merged_path: Option<PathBuf>,
    sample_rate: u32,
    channels: u16,
    bitrate: Bitrate,
    mut cons_system: impl Consumer<Item = f32>,
    mut cons_mic: impl Consumer<Item = f32>,
    paused: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
    paused_accum_ms: Arc<Mutex<u64>>,
    pause_started_at: Arc<Mutex<Option<Instant>>>,
) -> Result<(), String> {
    let mut mic_writer = Mp3Writer::create(&mic_path, sample_rate, channels, bitrate)?;
    let mut sys_writer = if let Some(p) = &sys_path {
        Some(Mp3Writer::create(p, sample_rate, channels, bitrate)?)
    } else {
        None
    };
    let mut merged_writer = if let Some(p) = &merged_path {
        Some(Mp3Writer::create(p, sample_rate, channels, bitrate)?)
    } else {
        None
    };

    eprintln!("[Writer] Mic path: {}", mic_path.display());
    if let Some(p) = &sys_path {
        eprintln!("[Writer] System path: {}", p.display());
    }
    if let Some(p) = &merged_path {
        eprintln!("[Writer] Merged path: {}", p.display());
    }

    let mut total_frames = 0u64;
    let mut mic_buf = Vec::with_capacity(2048);
    let mut sys_buf = Vec::with_capacity(2048);

    while !stop.load(Ordering::SeqCst) {
        if paused.load(Ordering::SeqCst) {
            std::thread::sleep(Duration::from_millis(20));
            continue;
        }

        mic_buf.clear();
        sys_buf.clear();

        // Read up to 2048 samples from mic
        for _ in 0..2048 {
            if let Some(s) = cons_mic.try_pop() {
                mic_buf.push(s);
            } else {
                break;
            }
        }

        // Read up to 2048 samples from system
        for _ in 0..2048 {
            if let Some(s) = cons_system.try_pop() {
                sys_buf.push(s);
            } else {
                break;
            }
        }

        let max_len = mic_buf.len().max(sys_buf.len());

        if max_len == 0 {
             std::thread::sleep(Duration::from_millis(5));
             continue;
        }

        for i in 0..max_len {
            let m = mic_buf.get(i).copied();
            let s = sys_buf.get(i).copied();

            if let Some(val) = m {
                mic_writer.write_frame(val, val)?;
            }

            if let Some(w) = &mut sys_writer {
                if let Some(val) = s {
                    w.write_frame(val, val)?;
                }
            }

            if let Some(w) = &mut merged_writer {
                let m_val = m.unwrap_or(0.0);
                let s_val = s.unwrap_or(0.0);
                let mixed = (m_val + s_val).max(-1.0).min(1.0);
                w.write_frame(mixed, mixed)?;
            }
        }
        
        total_frames += max_len as u64;
    }

    eprintln!(
        "[Writer] Finished: {} total loops",
        total_frames
    );

    if paused.load(Ordering::SeqCst) {
        if let Ok(mut pause_start) = pause_started_at.lock() {
            if let Some(t0) = pause_start.take() {
                if let Ok(mut accum) = paused_accum_ms.lock() {
                    *accum += t0.elapsed().as_millis() as u64;
                }
            }
        }
    }

    mic_writer.finalize()?;
    if let Some(w) = sys_writer {
        w.finalize()?;
    }
    if let Some(w) = merged_writer {
        w.finalize()?;
    }
    Ok(())
}
