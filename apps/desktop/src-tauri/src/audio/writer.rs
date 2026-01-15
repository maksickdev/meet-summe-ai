use std::path::Path;

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
