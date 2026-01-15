use cpal::traits::{DeviceTrait, HostTrait};

pub fn list_input_device_names() -> Result<Vec<String>, String> {
    let host = cpal::default_host();
    let mut names = Vec::new();
    let devices = host
        .input_devices()
        .map_err(|e| format!("Failed to enumerate input devices: {e}"))?;
    for device in devices {
        if let Ok(name) = device.name() {
            names.push(name);
        }
    }
    names.sort();
    names.dedup();
    Ok(names)
}

pub fn find_input_device_by_name(name: &str) -> Result<cpal::Device, String> {
    let host = cpal::default_host();
    let devices = host
        .input_devices()
        .map_err(|e| format!("Failed to enumerate input devices: {e}"))?;
    for device in devices {
        let dev_name = device.name().unwrap_or_default();
        if dev_name == name {
            return Ok(device);
        }
    }
    Err(format!("Input device not found: {name}"))
}
