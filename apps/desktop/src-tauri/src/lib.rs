//! Tauri backend for SumMe.
//!
//! The MVP focuses on:
//! - Native Rust audio capture (system output + microphone)
//! - File-based storage and JSON metadata for recordings

mod audio;
mod gemini;
mod storage;

use parking_lot::Mutex;

struct ActiveRecording {
    session: audio::recorder::RecordingSession,
    meta: storage::RecordingMetadata,
}

#[derive(Default)]
struct AppState {
    recording: Mutex<Option<ActiveRecording>>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! You've been greeted from Rust!")
}

#[tauri::command]
fn get_storage_dir(app: tauri::AppHandle) -> Result<String, String> {
    storage::resolve_storage_dir(&app).map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn set_storage_dir(app: tauri::AppHandle, path: String) -> Result<(), String> {
    storage::set_storage_dir(&app, &path)
}

#[tauri::command]
fn list_recordings(app: tauri::AppHandle) -> Result<Vec<storage::RecordingMetadata>, String> {
    storage::list_recordings(&app)
}

#[tauri::command]
fn get_recording(
    app: tauri::AppHandle,
    recording_id: String,
) -> Result<storage::RecordingMetadata, String> {
    storage::load_recording_metadata(&app, &recording_id)
}

#[tauri::command]
fn delete_recording(app: tauri::AppHandle, recording_id: String) -> Result<(), String> {
    storage::delete_recording(&app, &recording_id)
}

#[tauri::command]
fn has_gemini_api_key(app: tauri::AppHandle) -> Result<bool, String> {
    storage::has_gemini_api_key(&app)
}

#[tauri::command]
fn get_gemini_api_key(app: tauri::AppHandle) -> Result<String, String> {
    storage::get_gemini_api_key(&app)
}

#[tauri::command]
fn set_gemini_api_key(app: tauri::AppHandle, api_key: String) -> Result<(), String> {
    storage::set_gemini_api_key(&app, &api_key)
}

#[tauri::command]
fn clear_gemini_api_key(app: tauri::AppHandle) -> Result<(), String> {
    storage::clear_gemini_api_key(&app)
}

#[tauri::command]
async fn summarize_recording(
    app: tauri::AppHandle,
    recording_id: String,
    template_id: String,
) -> Result<storage::RecordingMetadata, String> {
    let api_key = storage::get_gemini_api_key(&app)?;
    let meta = storage::load_recording_metadata(&app, &recording_id)?;

    let audio_path = storage::abs_path(&app, &meta.audio.relative_path)?;
    let audio_mime = gemini::guess_audio_mime_type(&audio_path);
    let audio_bytes =
        std::fs::read(&audio_path).map_err(|e| format!("Failed to read audio file: {e}"))?;

    let markdown =
        gemini::summarize_audio_to_markdown(&api_key, audio_bytes, &audio_mime, &template_id)
            .await?;

    let md_rel = meta
        .markdown_relative_path
        .clone()
        .ok_or_else(|| "Recording has no markdown_relative_path.".to_string())?;
    let md_path = storage::abs_path(&app, &md_rel)?;
    if let Some(parent) = md_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create output dir: {e}"))?;
    }
    std::fs::write(&md_path, markdown).map_err(|e| format!("Failed to write markdown: {e}"))?;

    storage::save_recording_metadata(&app, &meta)?;
    Ok(meta)
}

#[tauri::command]
fn show_in_folder(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(path);
    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open in Finder: {e}"))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open in Explorer: {e}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(parent) = path.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open in file manager: {e}"))?;
        } else {
            return Err("Cannot determine parent directory.".to_string());
        }
    }

    Ok(())
}

#[tauri::command]
fn list_input_devices() -> Result<Vec<String>, String> {
    audio::device::list_input_device_names()
}

#[tauri::command]
fn start_recording(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    mic_device_name: Option<String>,
) -> Result<storage::RecordingMetadata, String> {
    let mut guard = state.recording.lock();
    if guard.is_some() {
        return Err("Recording already active.".to_string());
    }

    let meta = storage::create_new_recording(&app)?;
    let audio_path = storage::abs_path(&app, &meta.audio.relative_path)?;

    let session = audio::recorder::RecordingSession::start(audio_path, mic_device_name)?;
    *guard = Some(ActiveRecording {
        session,
        meta: meta.clone(),
    });

    Ok(meta)
}

#[tauri::command]
fn pause_recording(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let guard = state.recording.lock();
    let active = guard
        .as_ref()
        .ok_or_else(|| "No active recording.".to_string())?;
    active.session.pause()
}

#[tauri::command]
fn resume_recording(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let guard = state.recording.lock();
    let active = guard
        .as_ref()
        .ok_or_else(|| "No active recording.".to_string())?;
    active.session.resume()
}

#[tauri::command]
fn stop_recording(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<storage::RecordingMetadata, String> {
    let mut guard = state.recording.lock();
    let active = guard
        .take()
        .ok_or_else(|| "No active recording.".to_string())?;

    let result = active.session.stop()?;

    let mut meta = active.meta;
    meta.audio.duration_ms = Some(result.duration_ms);
    meta.audio.sample_rate = result.sample_rate;
    meta.audio.channels = result.channels;

    storage::save_recording_metadata(&app, &meta)?;
    Ok(meta)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_storage_dir,
            set_storage_dir,
            list_recordings,
            get_recording,
            has_gemini_api_key,
            get_gemini_api_key,
            set_gemini_api_key,
            clear_gemini_api_key,
            summarize_recording,
            delete_recording,
            show_in_folder,
            list_input_devices,
            start_recording,
            pause_recording,
            resume_recording,
            stop_recording
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
