//! Tauri backend for summe.
//!
//! The MVP focuses on:
//! - Native Rust audio capture (system output + microphone)
//! - File-based storage and JSON metadata for recordings

mod audio;
mod gemini;
mod storage;

use parking_lot::Mutex;
use std::sync::{atomic::{AtomicBool, Ordering}, Arc};
use std::thread;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent, TrayIcon},
    Emitter,
    Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;

struct ActiveRecording {
    session: audio::recorder::RecordingSession,
    meta: storage::RecordingMetadata,
}

#[derive(Default)]
struct AppState {
    recording: Mutex<Option<ActiveRecording>>,
    tray_icon: Mutex<Option<TrayIcon>>,
    tray_menu: Mutex<Option<Menu<tauri::Wry>>>,
    is_recording: Arc<AtomicBool>,
    current_shortcut: Mutex<Option<Shortcut>>,
    current_shortcut_str: Mutex<String>,
    shortcuts_disabled: AtomicBool,
}

fn register_hotkey(app: &tauri::AppHandle, hotkey_str: &str) -> Result<(), String> {
    use std::str::FromStr;
    let state = app.state::<AppState>();
    let shortcut = Shortcut::from_str(hotkey_str)
        .map_err(|e| format!("Invalid shortcut format '{}': {}", hotkey_str, e))?;

    println!("[Hotkey] Attempting to register: {}", hotkey_str);

    // Unregister everything to be sure we only have one recording hotkey
    let _ = app.global_shortcut().unregister_all();

    // Register new
    app.global_shortcut()
        .register(shortcut.clone())
        .map_err(|e| format!("Failed to register shortcut '{}': {}", hotkey_str, e))?;
    
    // Update both Shortcut object and string representation for match consistency
    let normalized = shortcut.to_string();
    *state.current_shortcut.lock() = Some(shortcut);
    *state.current_shortcut_str.lock() = normalized.clone();
    
    println!("[Hotkey] Successfully registered: {}", normalized);
    Ok(())
}

fn update_tray_menu(app: &tauri::AppHandle, is_recording: bool) {
    let state = app.state::<AppState>();
    if let Some(menu) = state.tray_menu.lock().as_ref() {
         if let Some(tauri::menu::MenuItemKind::MenuItem(start_i)) = menu.get("start") {
             let _ = start_i.set_enabled(!is_recording);
         }
         if let Some(tauri::menu::MenuItemKind::MenuItem(stop_i)) = menu.get("stop") {
             let _ = stop_i.set_enabled(is_recording);
         }
    }
    
        if !is_recording {
        if let Some(tray) = state.tray_icon.lock().as_ref() {
             let _ = tray.set_title(Some(""));
        }
    }
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

    // Update state and UI
    state.is_recording.store(true, Ordering::SeqCst);
    update_tray_menu(app, true);

    // Send notification
    let _ = app.notification()
        .builder()
        .title("Recording Started")
        .body("summe is recording your audio...")
        .show();

    if let Err(e) = app.emit("recording-started", &meta) {
        eprintln!("Failed to emit recording-started event: {}", e);
    }

    // Spawn tray timer thread
    let is_recording = state.is_recording.clone();
    let app_handle = app.clone();
    let start_time = std::time::Instant::now();
    
    thread::spawn(move || {
        while is_recording.load(Ordering::SeqCst) {
             let elapsed = start_time.elapsed();
             let secs = elapsed.as_secs();
             let h = secs / 3600;
             let m = (secs % 3600) / 60;
             let s = secs % 60;
             let title = format!("{:02}:{:02}:{:02}", h, m, s);
             
             let state = app_handle.state::<AppState>();
             
             // Check again to avoid race with stop_recording
             if !is_recording.load(Ordering::SeqCst) {
                 println!("[Tray] Loop explicitly breaking");
                 break;
             }

             if let Some(tray) = state.tray_icon.lock().as_ref() {
                 let _ = tray.set_title(Some(title));
             }
             
             thread::sleep(Duration::from_millis(1000));
        }
        
        println!("[Tray] Timer thread exiting");
        // Ensure title is cleared when thread exits
        let state = app_handle.state::<AppState>();
        let guard = state.tray_icon.lock();
        if let Some(tray) = guard.as_ref() {
             println!("[Tray] Clearing title");
             let _ = tray.set_title(Some(""));
        }
    });

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

    // Handle recording mode: if "merged", delete extra files and keep only the merged one as the main audio.
    let mode = storage::get_recording_mode(app).unwrap_or_else(|_| "merged".to_string());
    if mode == "merged" {
        let old_mic_path = storage::abs_path(app, &meta.audio.relative_path)?;
        let system_path = meta.system_audio.as_ref().and_then(|s| storage::abs_path(app, &s.relative_path).ok());
        let merged_path = meta.merged_audio.as_ref().and_then(|s| storage::abs_path(app, &s.relative_path).ok());

        // New relative path for merged mode
        let new_rel_path = meta.audio.relative_path.replace("mic.mp3", "recording.mp3");
        let new_abs_path = storage::abs_path(app, &new_rel_path)?;

        if let Some(m_path) = merged_path {
            if m_path.exists() {
                // Rename merged to recording.mp3
                let _ = std::fs::rename(&m_path, &new_abs_path);
            }
        }

        // Delete original mic file
        if old_mic_path.exists() {
            let _ = std::fs::remove_file(&old_mic_path);
        }

        // Delete system file if it exists
        if let Some(s_path) = system_path {
            if s_path.exists() {
                let _ = std::fs::remove_file(s_path);
            }
        }

        // Update metadata to reflect that only one file remains and its name is recording.mp3
        meta.audio.relative_path = new_rel_path;
        meta.system_audio = None;
        meta.merged_audio = None;
    }

    storage::save_recording_metadata(app, &meta)?;
    
    // Update state and UI
    state.is_recording.store(false, Ordering::SeqCst);
    update_tray_menu(app, false);

    // Send notification
    let _ = app.notification()
        .builder()
        .title("Recording Saved")
        .body("Your recording has been saved successfully.")
        .show();

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
fn get_recording_mode(app: tauri::AppHandle) -> Result<String, String> {
    storage::get_recording_mode(&app)
}

#[tauri::command]
fn set_recording_mode(app: tauri::AppHandle, mode: String) -> Result<(), String> {
    storage::set_recording_mode(&app, mode)
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

#[tauri::command]
fn get_recording_hotkey(app: tauri::AppHandle) -> Result<String, String> {
    storage::get_recording_hotkey(&app)
}

#[tauri::command]
fn set_recording_hotkey(app: tauri::AppHandle, hotkey: String) -> Result<(), String> {
    register_hotkey(&app, &hotkey)?;
    storage::set_recording_hotkey(&app, &hotkey)
}

#[tauri::command]
fn set_shortcuts_disabled(state: tauri::State<'_, AppState>, disabled: bool) {
    state.shortcuts_disabled.store(disabled, Ordering::SeqCst);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .setup(|app| {
            let show_i = MenuItem::with_id(app, "show", "Show summe", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let start_i = MenuItem::with_id(app, "start", "Start Recording", true, None::<&str>)?;
            let stop_i = MenuItem::with_id(app, "stop", "Stop Recording", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[
                &show_i,
                &tauri::menu::PredefinedMenuItem::separator(app)?,
                &start_i,
                &stop_i,
                &quit_i
            ])?;
            
            // Initial menu state: stop disabled
            let _ = stop_i.set_enabled(false);

            let tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false) // We want to handle clicks manually or show menu on right-click
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    "start" => {
                        let state = app.state::<AppState>();
                        if let Err(e) = do_start_recording(app, &state, None) {
                            eprintln!("Failed to start recording from tray: {}", e);
                            let _ = app.notification().builder()
                                .title("Error")
                                .body(&format!("Failed to start recording: {}", e))
                                .show();
                        } else {
                            println!("Started recording from tray");
                        }
                    }
                    "stop" => {
                        let state = app.state::<AppState>();
                        if let Err(e) = do_stop_recording(app, &state) {
                            eprintln!("Failed to stop recording from tray: {}", e);
                            let _ = app.notification().builder()
                                .title("Error")
                                .body(&format!("Failed to stop recording: {}", e))
                                .show();
                        } else {
                            println!("Stopped recording from tray");
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            
            // Store tray handle and menu
            let state = app.state::<AppState>();
            *state.tray_icon.lock() = Some(tray);
            *state.tray_menu.lock() = Some(menu);

            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new().with_handler(move |app, key, event| {
                    if event.state == ShortcutState::Pressed {
                        let state = app.state::<AppState>();
                        
                        // Check if shortcuts are globally disabled (e.g. while settings open)
                        if state.shortcuts_disabled.load(Ordering::SeqCst) {
                            return;
                        }

                        // Match using the string representation to be more robust across dynamic registrations
                        let is_match = {
                            let registered_str = state.current_shortcut_str.lock();
                            let incoming_str = key.to_string();
                            
                            // Log for debugging if not match
                            // println!("[Hotkey] Incoming: '{}', Registered: '{}'", incoming_str, *registered_str);
                            
                            incoming_str == *registered_str
                        };

                        if is_match {
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
                    }
                })
                .build(),
            )?;
            
            let hotkey = storage::get_recording_hotkey(app.handle())?;
            if let Err(e) = register_hotkey(app.handle(), &hotkey) {
                eprintln!("Failed to register initial shortcut: {}", e);
            }

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
            get_recording_mode,
            set_recording_mode,
            get_preferred_mic,
            set_preferred_mic,
            get_recording_quality,
            set_recording_quality,
            get_recording_hotkey,
            set_recording_hotkey,
            set_shortcuts_disabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

