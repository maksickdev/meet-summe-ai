use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::traits::{Consumer, Producer, Split};

use crate::audio::device;
use crate::audio::writer::WavStereoWriter;

#[derive(Debug, Clone, serde::Serialize)]
pub struct RecordingResult {
    pub audio_path: String,
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
    audio_path: PathBuf,
    threads: Vec<JoinHandle<Result<(), String>>>,
}

impl RecordingSession {
    pub fn start(audio_path: PathBuf, mic_device_name: Option<String>) -> Result<Self, String> {
        // Fixed sample rate for consistent audio quality
        const SAMPLE_RATE: u32 = 48_000;

        // Buffer about ~2 seconds at 48kHz. Writer drains it continuously.
        let rb_system = ringbuf::HeapRb::<f32>::new(96_000);
        let rb_mic = ringbuf::HeapRb::<f32>::new(96_000);
        let (prod_system, cons_system) = rb_system.split();
        let (prod_mic, cons_mic) = rb_mic.split();

        let paused = Arc::new(AtomicBool::new(false));
        let stop = Arc::new(AtomicBool::new(false));
        let started_at = Instant::now();
        let paused_accum_ms = Arc::new(Mutex::new(0u64));
        let pause_started_at = Arc::new(Mutex::new(None::<Instant>));

        let sample_rate = SAMPLE_RATE;

        let writer_thread = {
            let paused = Arc::clone(&paused);
            let stop = Arc::clone(&stop);
            let audio_path = audio_path.clone();
            let paused_accum_ms = Arc::clone(&paused_accum_ms);
            let pause_started_at = Arc::clone(&pause_started_at);
            std::thread::spawn(move || {
                writer_loop(
                    audio_path,
                    sample_rate,
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
            std::thread::spawn(move || system_capture_loop(prod_system, paused, stop))
        };
        threads.push(system_thread);

        // Microphone capture via cpal with fixed sample rate.
        let mic_thread = {
            let paused = Arc::clone(&paused);
            let stop = Arc::clone(&stop);
            std::thread::spawn(move || {
                mic_capture_loop(prod_mic, mic_device_name, SAMPLE_RATE, paused, stop)
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
            audio_path,
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
            sample_rate: self.sample_rate,
            channels: 2,
            duration_ms,
        })
    }
}

fn system_capture_loop(
    prod_system: impl Producer<Item = f32> + Send + 'static,
    paused: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
) -> Result<(), String> {
    use qruhear::{rucallback, RUBuffers, RUHear};

    let producer = Arc::new(Mutex::new(prod_system));
    let stop_cb = Arc::clone(&stop);
    let paused_cb = Arc::clone(&paused);
    let callback = move |audio_buffers: RUBuffers| {
        if stop_cb.load(Ordering::SeqCst) || paused_cb.load(Ordering::SeqCst) {
            return;
        }
        if audio_buffers.is_empty() {
            return;
        }
        // Downmix to mono by averaging all channels.
        let frames = audio_buffers[0].len();
        for i in 0..frames {
            let mut sum = 0.0f32;
            for ch in &audio_buffers {
                if let Some(s) = ch.get(i) {
                    sum += *s;
                }
            }
            let v = sum / (audio_buffers.len() as f32);
            if let Ok(mut p) = producer.lock() {
                let _ = p.try_push(v);
            }
        }
    };

    let callback = rucallback!(callback);
    let mut ruhear = RUHear::new(callback);
    ruhear
        .start()
        .map_err(|e| format!("Failed to start system audio capture: {e}"))?;

    while !stop.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_millis(50));
    }
    ruhear
        .stop()
        .map_err(|e| format!("Failed to stop system audio capture: {e}"))?;
    Ok(())
}

fn mic_capture_loop(
    prod_mic: impl Producer<Item = f32> + Send + 'static,
    mic_device_name: Option<String>,
    sample_rate: u32,
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

    let (config, sample_format) = select_mic_config(&device, sample_rate)?;
    let channels = config.channels as usize;

    let prod = Arc::new(Mutex::new(prod_mic));
    let err_fn = |err| eprintln!("cpal input stream error: {err}");

    let stop_f32 = Arc::clone(&stop);
    let paused_f32 = Arc::clone(&paused);
    let stop_i16 = Arc::clone(&stop);
    let paused_i16 = Arc::clone(&paused);
    let stop_u16 = Arc::clone(&stop);
    let paused_u16 = Arc::clone(&paused);

    let stream = match sample_format {
        cpal::SampleFormat::F32 => device.build_input_stream(
            &config,
            {
                let prod = Arc::clone(&prod);
                move |data: &[f32], _| {
                    write_mic_samples_f32(data, channels, &prod, &paused_f32, &stop_f32)
                }
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::I16 => device.build_input_stream(
            &config,
            {
                let prod = Arc::clone(&prod);
                move |data: &[i16], _| {
                    write_mic_samples_i16(data, channels, &prod, &paused_i16, &stop_i16)
                }
            },
            err_fn,
            None,
        ),
        cpal::SampleFormat::U16 => device.build_input_stream(
            &config,
            {
                let prod = Arc::clone(&prod);
                move |data: &[u16], _| {
                    write_mic_samples_u16(data, channels, &prod, &paused_u16, &stop_u16)
                }
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

    while !stop.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_millis(50));
    }
    drop(stream);
    Ok(())
}

fn write_mic_samples_f32<P: Producer<Item = f32>>(
    data: &[f32],
    channels: usize,
    prod: &Arc<Mutex<P>>,
    paused: &Arc<AtomicBool>,
    stop: &Arc<AtomicBool>,
) {
    if stop.load(Ordering::SeqCst) || paused.load(Ordering::SeqCst) {
        return;
    }
    if let Ok(mut p) = prod.lock() {
        if channels <= 1 {
            for s in data {
                let _ = p.try_push(*s);
            }
            return;
        }

        // Downmix interleaved multi-channel input to mono.
        for frame in data.chunks(channels) {
            let mut sum = 0.0f32;
            for s in frame {
                sum += *s;
            }
            let _ = p.try_push(sum / (channels as f32));
        }
    }
}

fn write_mic_samples_i16<P: Producer<Item = f32>>(
    data: &[i16],
    channels: usize,
    prod: &Arc<Mutex<P>>,
    paused: &Arc<AtomicBool>,
    stop: &Arc<AtomicBool>,
) {
    write_mic_samples_with_convert(data, channels, prod, paused, stop, |s| {
        (s as f32) / (i16::MAX as f32)
    });
}

fn write_mic_samples_u16<P: Producer<Item = f32>>(
    data: &[u16],
    channels: usize,
    prod: &Arc<Mutex<P>>,
    paused: &Arc<AtomicBool>,
    stop: &Arc<AtomicBool>,
) {
    write_mic_samples_with_convert(data, channels, prod, paused, stop, |s| {
        (s as f32 - 32768.0) / 32768.0
    });
}

fn write_mic_samples_with_convert<T, P: Producer<Item = f32>>(
    data: &[T],
    channels: usize,
    prod: &Arc<Mutex<P>>,
    paused: &Arc<AtomicBool>,
    stop: &Arc<AtomicBool>,
    mut convert: impl FnMut(T) -> f32,
) where
    T: Copy,
{
    if stop.load(Ordering::SeqCst) || paused.load(Ordering::SeqCst) {
        return;
    }
    if let Ok(mut p) = prod.lock() {
        if channels <= 1 {
            for s in data {
                let _ = p.try_push(convert(*s));
            }
            return;
        }
        for frame in data.chunks(channels) {
            let mut sum = 0.0f32;
            for s in frame {
                sum += convert(*s);
            }
            let _ = p.try_push(sum / (channels as f32));
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

    // Fallback to default config with adjusted sample rate
    let mut config = default.config();
    config.sample_rate = cpal::SampleRate(desired_rate);
    Ok((config, default_format))
}

fn writer_loop(
    audio_path: PathBuf,
    sample_rate: u32,
    mut cons_system: impl Consumer<Item = f32>,
    mut cons_mic: impl Consumer<Item = f32>,
    paused: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
    paused_accum_ms: Arc<Mutex<u64>>,
    pause_started_at: Arc<Mutex<Option<Instant>>>,
) -> Result<(), String> {
    let mut writer = WavStereoWriter::create(&audio_path, sample_rate)?;

    while !stop.load(Ordering::SeqCst) {
        if paused.load(Ordering::SeqCst) {
            std::thread::sleep(Duration::from_millis(20));
            continue;
        }
        let mut wrote = 0usize;
        for _ in 0..2048 {
            let system = cons_system.try_pop();
            let mic = cons_mic.try_pop();
            match (system, mic) {
                (None, None) => break,
                (s, m) => {
                    writer.write_frame(s.unwrap_or(0.0), m.unwrap_or(0.0))?;
                    wrote += 1;
                }
            }
        }
        if wrote == 0 {
            std::thread::sleep(Duration::from_millis(5));
        }
    }

    // If we were paused at stop time, account for the final pause interval.
    if paused.load(Ordering::SeqCst) {
        if let Ok(mut pause_start) = pause_started_at.lock() {
            if let Some(t0) = pause_start.take() {
                if let Ok(mut accum) = paused_accum_ms.lock() {
                    *accum += t0.elapsed().as_millis() as u64;
                }
            }
        }
    }

    writer.finalize()?;
    Ok(())
}
