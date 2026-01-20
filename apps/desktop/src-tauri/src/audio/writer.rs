use mp3lame_encoder::{Bitrate, Builder, DualPcm, Encoder, FlushNoGap, MonoPcm, Quality};
use std::io::Write;
use std::mem::MaybeUninit;
use std::path::Path;

pub struct Mp3Writer {
    encoder: Encoder,
    writer: std::io::BufWriter<std::fs::File>,
    channels: u16,
    // Buffers to accumulate samples before encoding
    left_buf: Vec<i16>,
    right_buf: Vec<i16>,
}

impl Mp3Writer {
    pub fn create(path: &Path, sample_rate: u32, channels: u16, bitrate: Bitrate) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create recording directory: {e}"))?;
        }

        let file = std::fs::File::create(path)
            .map_err(|e| format!("Failed to create MP3 file: {e}"))?;
        let writer = std::io::BufWriter::new(file);

        let mut builder = Builder::new().expect("Create LAME builder");
        builder.set_num_channels(channels as u8).expect("set channels");
        builder.set_sample_rate(sample_rate).expect("set rate");
        builder.set_brate(bitrate).expect("set bitrate");
        builder.set_quality(Quality::Good).expect("set quality");

        let encoder = builder.build().expect("build encoder");
        
        Ok(Self { 
            encoder, 
            writer,
            channels,
            left_buf: Vec::with_capacity(4096),
            right_buf: Vec::with_capacity(4096),
        })
    }

    pub fn write_frame(&mut self, l: f32, r: f32) -> Result<(), String> {
        self.left_buf.push(float_to_i16(l));
        if self.channels == 2 {
            self.right_buf.push(float_to_i16(r));
        }

        // Encode in chunks to be efficient
        if self.left_buf.len() >= 1152 { // 1152 is a common MP3 frame size
            self.encode_chunk()?;
        }
        Ok(())
    }

    fn encode_chunk(&mut self) -> Result<(), String> {
        if self.left_buf.is_empty() {
            return Ok(());
        }
        
        // Use MaybeUninit for the output buffer as required by the library
        let buf_size = (self.left_buf.len() as f64 * 1.25) as usize + 7200;
        let mut mp3_buf: Vec<MaybeUninit<u8>> = Vec::with_capacity(buf_size);
        // Safely set the length since we're giving it to C code that will write to it
        unsafe { mp3_buf.set_len(buf_size) };
        
        let encoded_size = if self.channels == 1 {
            let input = MonoPcm(&self.left_buf);
            self.encoder
                .encode(input, &mut mp3_buf)
                .map_err(|e| format!("LAME encode error: {:?}", e))?
        } else {
            let input = DualPcm {
                left: &self.left_buf,
                right: &self.right_buf,
            };
            self.encoder
                .encode(input, &mut mp3_buf)
                .map_err(|e| format!("LAME encode error: {:?}", e))?
        };
            
        if encoded_size > 0 {
            // Convert back to initialized slice for writing
            let initialized_data = unsafe {
                std::slice::from_raw_parts(mp3_buf.as_ptr() as *const u8, encoded_size)
            };
            self.writer.write_all(initialized_data)
                .map_err(|e| format!("Failed to write MP3 data: {e}"))?;
        }
        
        self.left_buf.clear();
        self.right_buf.clear();
        Ok(())
    }

    pub fn finalize(mut self) -> Result<(), String> {
        // Encode remaining samples
        self.encode_chunk()?;
        
        // Flush the encoder
        let mut mp3_buf: Vec<MaybeUninit<u8>> = Vec::with_capacity(7200);
        unsafe { mp3_buf.set_len(7200) };
        
        let encoded_size = self.encoder
            .flush::<FlushNoGap>(&mut mp3_buf)
            .map_err(|e| format!("LAME flush error: {:?}", e))?;
            
        if encoded_size > 0 {
            let initialized_data = unsafe {
                std::slice::from_raw_parts(mp3_buf.as_ptr() as *const u8, encoded_size)
            };
            self.writer.write_all(initialized_data)
                .map_err(|e| format!("Failed to write flushed MP3 data: {e}"))?;
        }
        
        self.writer.flush().map_err(|e| format!("Failed to flush file: {e}"))?;
        Ok(())
    }
}

// Keeping WavStereoWriter for backward compatibility if needed, but we'll use Mp3Writer
pub struct WavStereoWriter {
    writer: hound::WavWriter<std::io::BufWriter<std::fs::File>>,
}

impl WavStereoWriter {
    pub fn create(path: &Path, sample_rate: u32) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create recording directory: {e}"))?;
        }
        let spec = hound::WavSpec {
            channels: 2,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let writer = hound::WavWriter::create(path, spec)
            .map_err(|e| format!("Failed to create WAV file: {e}"))?;
        Ok(Self { writer })
    }

    pub fn write_frame(&mut self, system: f32, mic: f32) -> Result<(), String> {
        let s = float_to_i16(system);
        let m = float_to_i16(mic);
        self.writer
            .write_sample::<i16>(s)
            .map_err(|e| format!("Failed to write WAV sample: {e}"))?;
        self.writer
            .write_sample::<i16>(m)
            .map_err(|e| format!("Failed to write WAV sample: {e}"))?;
        Ok(())
    }

    pub fn finalize(self) -> Result<(), String> {
        self.writer
            .finalize()
            .map_err(|e| format!("Failed to finalize WAV file: {e}"))
    }
}

fn float_to_i16(v: f32) -> i16 {
    let v = v.clamp(-1.0, 1.0);
    (v * i16::MAX as f32) as i16
}
