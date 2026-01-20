//! Tauri backend for SumMe.
//!
//! The MVP focuses on:
//! - Native Rust audio capture (system output + microphone)
//! - File-based storage and JSON metadata for recordings

mod audio;
mod gemini;
mod storage;

use parking_lot::Mutex;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter,
    Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

struct ActiveRecording {
    session: audio::recorder::RecordingSession,
    meta: storage::RecordingMetadata,
}

#[derive(Default)]
struct AppState {
    recording: Mutex<Option<ActiveRecording>>,
}

fn do_start_recording(
    app: &tauri::AppHandle,
    state: &AppState,
    mic_device_name: Option<String>,
) -> Result<storage::RecordingMetadata, String> {
    let mut guard = state.recording.lock();
    if guard.is_some() {
        return Err("Recording already active.".to_string());
    }

    // Determine microphone to use
    let mic_name = if let Some(name) = mic_device_name {
        // Update preference if explicitly selected
        let _ = storage::set_preferred_mic(app, Some(name.clone()));
        Some(name)
    } else {
        // Fallback to preference, or None (default device)
        storage::get_preferred_mic(app).unwrap_or(None)
    };

    let meta = storage::create_new_recording(app)?;
    let audio_path = storage::abs_path(app, &meta.audio.relative_path)?;
    let system_audio_path = meta
        .system_audio
        .as_ref()
        .map(|s| storage::abs_path(app, &s.relative_path))
        .transpose()?;
    let merged_audio_path = meta
        .merged_audio
        .as_ref()
        .map(|s| storage::abs_path(app, &s.relative_path))
        .transpose()?;

    let quality = storage::get_recording_quality(app).unwrap_or_else(|_| "quality".to_string());

    let session = audio::recorder::RecordingSession::start(
        audio_path,
        system_audio_path,
        merged_audio_path,
        mic_name,
        &quality,
    )?;
    *guard = Some(ActiveRecording {
        session,
        meta: meta.clone(),
    });

    if let Err(e) = app.emit("recording-started", &meta) {
        eprintln!("Failed to emit recording-started event: {}", e);
    }

    Ok(meta)
}

fn do_stop_recording(
    app: &tauri::AppHandle,
    state: &AppState,
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

    if let Some(sys) = &mut meta.system_audio {
        sys.duration_ms = Some(result.duration_ms);
        sys.sample_rate = result.sample_rate;
        sys.channels = result.channels;
    }

    if let Some(merged) = &mut meta.merged_audio {
        merged.duration_ms = Some(result.duration_ms);
        merged.sample_rate = result.sample_rate;
        merged.channels = result.channels;
    }

    storage::save_recording_metadata(app, &meta)?;
    
    if let Err(e) = app.emit("recording-stopped", &meta) {
        eprintln!("Failed to emit recording-stopped event: {}", e);
    }

    Ok(meta)
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
fn rename_recording(
    app: tauri::AppHandle,
    recording_id: String,
    new_title: String,
) -> Result<(), String> {
    storage::rename_recording(&app, &recording_id, &new_title)
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
    do_start_recording(&app, &state, mic_device_name)
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
    do_stop_recording(&app, &state)
}

#[tauri::command]
fn read_recording_note(app: tauri::AppHandle, recording_id: String) -> Result<String, String> {
    storage::read_recording_note(&app, &recording_id)
}

#[tauri::command]
fn save_recording_note(
    app: tauri::AppHandle,
    recording_id: String,
    content: String,
) -> Result<(), String> {
    storage::save_recording_note(&app, &recording_id, &content)
}

#[tauri::command]
fn get_merge_audio_files(app: tauri::AppHandle) -> Result<bool, String> {
    storage::get_merge_audio_files(&app)
}

#[tauri::command]
fn set_merge_audio_files(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    storage::set_merge_audio_files(&app, enabled)
}

#[tauri::command]
fn get_preferred_mic(app: tauri::AppHandle) -> Result<Option<String>, String> {
    storage::get_preferred_mic(&app)
}

#[tauri::command]
fn set_preferred_mic(app: tauri::AppHandle, name: Option<String>) -> Result<(), String> {
    storage::set_preferred_mic(&app, name)
}

#[tauri::command]
fn get_recording_quality(app: tauri::AppHandle) -> Result<String, String> {
    storage::get_recording_quality(&app)
}

#[tauri::command]
fn set_recording_quality(app: tauri::AppHandle, quality: String) -> Result<(), String> {
    storage::set_recording_quality(&app, &quality)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let start_i = MenuItem::with_id(app, "start", "Start Recording", true, None::<&str>)?;
            let stop_i = MenuItem::with_id(app, "stop", "Stop Recording", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&start_i, &stop_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "start" => {
                        let state = app.state::<AppState>();
                        if let Err(e) = do_start_recording(app, &state, None) {
                            eprintln!("Failed to start recording from tray: {}", e);
                        } else {
                            println!("Started recording from tray");
                        }
                    }
                    "stop" => {
                        let state = app.state::<AppState>();
                        if let Err(e) = do_stop_recording(app, &state) {
                            eprintln!("Failed to stop recording from tray: {}", e);
                        } else {
                            println!("Stopped recording from tray");
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            // Global Shortcut: Cmd+Shift+R (or Ctrl+Shift+R)
            #[cfg(target_os = "macos")]
            let modifiers = Modifiers::SUPER | Modifiers::SHIFT;
            #[cfg(not(target_os = "macos"))]
            let modifiers = Modifiers::CONTROL | Modifiers::SHIFT;

            let shortcut = Shortcut::new(Some(modifiers), Code::KeyR);
            
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new().with_handler(move |app, key, event| {
                    if event.state == ShortcutState::Pressed && key == &shortcut {
                        let state = app.state::<AppState>();
                        let is_recording = state.recording.lock().is_some();
                        if is_recording {
                            if let Err(e) = do_stop_recording(app, &state) {
                                eprintln!("Failed to stop recording via shortcut: {}", e);
                            } else {
                                println!("Stopped recording via shortcut");
                            }
                        } else {
                            if let Err(e) = do_start_recording(app, &state, None) {
                                eprintln!("Failed to start recording via shortcut: {}", e);
                            } else {
                                println!("Started recording via shortcut");
                            }
                        }
                    }
                })
                .build(),
            )?;
            
            app.global_shortcut().register(shortcut)?;

            Ok(())
        })
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
            rename_recording,
            show_in_folder,
            list_input_devices,
            start_recording,
            pause_recording,
            resume_recording,
            stop_recording,
            read_recording_note,
            save_recording_note,
            get_merge_audio_files,
            set_merge_audio_files,
            get_preferred_mic,
            set_preferred_mic,
            get_recording_quality,
            set_recording_quality
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
