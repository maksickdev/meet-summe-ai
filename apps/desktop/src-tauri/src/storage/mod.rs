use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::Manager;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingAudioInfo {
    pub relative_path: String,
    pub duration_ms: Option<u64>,
    pub format: String,
    pub sample_rate: u32,
    pub channels: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingMetadata {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub title: Option<String>,
    pub audio: RecordingAudioInfo,               // Microphone audio (primary)
    pub system_audio: Option<RecordingAudioInfo>, // System audio (optional)
    pub merged_audio: Option<RecordingAudioInfo>, // Merged audio (optional)
    pub markdown_relative_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct Settings {
    storage_dir: Option<String>,
    gemini_api_key: Option<String>,
    recording_mode: Option<String>, // "merged" | "separated"
    preferred_mic_name: Option<String>,
    recording_quality: Option<String>,
    recording_hotkey: Option<String>,
}

pub fn resolve_storage_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let settings = load_settings(app)?;
    if let Some(p) = settings.storage_dir {
        return Ok(PathBuf::from(p));
    }
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))
}

pub fn set_storage_dir(app: &tauri::AppHandle, path: &str) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !path.is_absolute() {
        return Err("Storage directory must be an absolute path.".to_string());
    }

    let mut settings = load_settings(app)?;
    settings.storage_dir = Some(path.to_string_lossy().to_string());
    save_settings(app, &settings)
}

pub fn create_new_recording(app: &tauri::AppHandle) -> Result<RecordingMetadata, String> {
    let created_at = Utc::now();
    let uuid = Uuid::new_v4();
    let id = format!("{}_{}", created_at.format("%Y-%m-%dT%H-%M-%SZ"), uuid);

    let audio_relative_path = format!("recordings/{id}/mic.mp3");
    let system_audio_relative_path = format!("recordings/{id}/system.mp3");
    let merged_audio_relative_path = format!("recordings/{id}/merged.mp3");
    let markdown_relative_path = Some(format!("recordings/{id}/notes.md"));

    let settings = load_settings(app)?;
    let mode = settings.recording_mode.as_deref().unwrap_or("merged");

    // We always create paths for system and merged tracks during recording 
    // to allow backend to perform AEC and merging. 
    // We will clean up files in do_stop_recording if mode is "merged".
    
    let meta = RecordingMetadata {
        id,
        created_at,
        title: None,
        audio: RecordingAudioInfo {
            relative_path: audio_relative_path,
            duration_ms: None,
            format: "mp3".to_string(),
            sample_rate: 48_000,
            channels: 2,
        },
        system_audio: Some(RecordingAudioInfo {
            relative_path: system_audio_relative_path,
            duration_ms: None,
            format: "mp3".to_string(),
            sample_rate: 48_000,
            channels: 2,
        }),
        merged_audio: Some(RecordingAudioInfo {
            relative_path: merged_audio_relative_path,
            duration_ms: None,
            format: "mp3".to_string(),
            sample_rate: 48_000,
            channels: 2,
        }),
        markdown_relative_path,
    };

    save_recording_metadata(app, &meta)?;
    Ok(meta)
}

pub fn get_recording_mode(app: &tauri::AppHandle) -> Result<String, String> {
    let settings = load_settings(app)?;
    Ok(settings.recording_mode.unwrap_or_else(|| "merged".to_string()))
}

pub fn set_recording_mode(app: &tauri::AppHandle, mode: String) -> Result<(), String> {
    if mode != "merged" && mode != "separated" {
        return Err("Invalid recording mode".to_string());
    }
    let mut settings = load_settings(app)?;
    settings.recording_mode = Some(mode);
    save_settings(app, &settings)
}

pub fn get_preferred_mic(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    let settings = load_settings(app)?;
    Ok(settings.preferred_mic_name)
}

pub fn set_preferred_mic(app: &tauri::AppHandle, name: Option<String>) -> Result<(), String> {
    let mut settings = load_settings(app)?;
    settings.preferred_mic_name = name;
    save_settings(app, &settings)
}

pub fn get_recording_quality(app: &tauri::AppHandle) -> Result<String, String> {
    let settings = load_settings(app)?;
    Ok(settings.recording_quality.unwrap_or_else(|| "quality".to_string()))
}

pub fn set_recording_quality(app: &tauri::AppHandle, quality: &str) -> Result<(), String> {
    if quality != "quality" && quality != "size" {
        return Err("Invalid quality setting".to_string());
    }
    let mut settings = load_settings(app)?;
    settings.recording_quality = Some(quality.to_string());
    save_settings(app, &settings)
}

pub fn get_recording_hotkey(app: &tauri::AppHandle) -> Result<String, String> {
    let settings = load_settings(app)?;
    Ok(settings.recording_hotkey.unwrap_or_else(|| {
        #[cfg(target_os = "macos")]
        {
            "Command+Shift+R".to_string()
        }
        #[cfg(not(target_os = "macos"))]
        {
            "Ctrl+Shift+R".to_string()
        }
    }))
}

pub fn set_recording_hotkey(app: &tauri::AppHandle, hotkey: &str) -> Result<(), String> {
    let mut settings = load_settings(app)?;
    settings.recording_hotkey = Some(hotkey.to_string());
    save_settings(app, &settings)
}

pub fn list_recordings(app: &tauri::AppHandle) -> Result<Vec<RecordingMetadata>, String> {
    let base = resolve_storage_dir(app)?;
    let rec_dir = base.join("recordings");
    if !rec_dir.exists() {
        return Ok(Vec::new());
    }

    let mut out = Vec::new();
    for entry in
        std::fs::read_dir(&rec_dir).map_err(|e| format!("Failed to read recordings dir: {e}"))?
    {
        let entry = entry.map_err(|e| format!("Failed to read recordings dir entry: {e}"))?;
        if !entry
            .file_type()
            .map_err(|e| format!("Failed to stat dir entry: {e}"))?
            .is_dir()
        {
            continue;
        }
        let meta_path = entry.path().join("metadata.json");
        if !meta_path.exists() {
            continue;
        }
        let bytes =
            std::fs::read(&meta_path).map_err(|e| format!("Failed to read metadata: {e}"))?;
        let meta: RecordingMetadata =
            serde_json::from_slice(&bytes).map_err(|e| format!("Invalid metadata.json: {e}"))?;
        out.push(meta);
    }

    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(out)
}

pub fn load_recording_metadata(
    app: &tauri::AppHandle,
    id: &str,
) -> Result<RecordingMetadata, String> {
    let path = recording_dir(app, id)?.join("metadata.json");
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read metadata: {e}"))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("Invalid metadata.json: {e}"))
}

pub fn save_recording_metadata(
    app: &tauri::AppHandle,
    meta: &RecordingMetadata,
) -> Result<(), String> {
    let dir = recording_dir(app, &meta.id)?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create recording directory: {e}"))?;

    let path = dir.join("metadata.json");
    let bytes = serde_json::to_vec_pretty(meta)
        .map_err(|e| format!("Failed to serialize metadata: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| format!("Failed to write metadata: {e}"))
}

pub fn delete_recording(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    let dir = recording_dir(app, id)?;
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| format!("Failed to delete recording: {e}"))?;
    }
    Ok(())
}

pub fn rename_recording(app: &tauri::AppHandle, id: &str, new_title: &str) -> Result<(), String> {
    let mut meta = load_recording_metadata(app, id)?;
    meta.title = Some(new_title.to_string());
    save_recording_metadata(app, &meta)
}

pub fn read_recording_note(app: &tauri::AppHandle, id: &str) -> Result<String, String> {
    let meta = load_recording_metadata(app, id)?;
    let rel_path = meta
        .markdown_relative_path
        .ok_or("No markdown note for this recording")?;
    let path = abs_path(app, &rel_path)?;
    if !path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(path).map_err(|e| format!("Failed to read note: {e}"))
}

pub fn save_recording_note(app: &tauri::AppHandle, id: &str, content: &str) -> Result<(), String> {
    let meta = load_recording_metadata(app, id)?;
    let rel_path = meta
        .markdown_relative_path
        .ok_or("No markdown note for this recording")?;
    let path = abs_path(app, &rel_path)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create note dir: {e}"))?;
    }
    std::fs::write(path, content).map_err(|e| format!("Failed to save note: {e}"))
}

pub fn abs_path(app: &tauri::AppHandle, relative_path: &str) -> Result<PathBuf, String> {
    Ok(resolve_storage_dir(app)?.join(relative_path))
}

fn recording_dir(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    Ok(resolve_storage_dir(app)?.join("recordings").join(id))
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
    Ok(base.join("settings.json"))
}

fn load_settings(app: &tauri::AppHandle) -> Result<Settings, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(Settings::default());
    }
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read settings: {e}"))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("Invalid settings.json: {e}"))
}

fn save_settings(app: &tauri::AppHandle, settings: &Settings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings dir: {e}"))?;
    }
    let bytes = serde_json::to_vec_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| format!("Failed to write settings: {e}"))
}

// Gemini API key management
pub fn has_gemini_api_key(app: &tauri::AppHandle) -> Result<bool, String> {
    let settings = load_settings(app)?;
    Ok(settings
        .gemini_api_key
        .as_ref()
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false))
}

pub fn get_gemini_api_key(app: &tauri::AppHandle) -> Result<String, String> {
    let settings = load_settings(app)?;
    settings
        .gemini_api_key
        .filter(|k| !k.trim().is_empty())
        .ok_or_else(|| "Gemini API key is not set.".to_string())
}

pub fn set_gemini_api_key(app: &tauri::AppHandle, api_key: &str) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("Gemini API key must not be empty.".to_string());
    }
    let mut settings = load_settings(app)?;
    settings.gemini_api_key = Some(api_key.to_string());
    save_settings(app, &settings)
}

pub fn clear_gemini_api_key(app: &tauri::AppHandle) -> Result<(), String> {
    let mut settings = load_settings(app)?;
    settings.gemini_api_key = None;
    save_settings(app, &settings)
}
