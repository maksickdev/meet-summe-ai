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
pub struct RecordingNote {
    pub id: String,
    pub prompt_id: String,
    pub relative_path: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSet {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub mic: RecordingAudioInfo,
    pub system: Option<RecordingAudioInfo>,
    pub merged: Option<RecordingAudioInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingMetadata {
    pub id: String,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<DateTime<Utc>>,
    pub title: Option<String>,
    #[serde(default)]
    pub audio_parts: Vec<AudioSet>,
    // Deprecated fields: kept with skip_serializing so they are readable from old
    // recordings but no longer written on new ones.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio: Option<RecordingAudioInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_audio: Option<RecordingAudioInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub merged_audio: Option<RecordingAudioInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub markdown_relative_path: Option<String>,
    pub notes: Option<Vec<RecordingNote>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomPrompt {
    pub id: String,
    pub name: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    pub storage_dir: Option<String>,
    pub gemini_api_key: Option<String>,
    pub gemini_model: Option<String>,   // e.g. "gemini-3-flash-preview"
    pub recording_mode: Option<String>, // "merged" | "separated"
    pub preferred_mic_name: Option<String>,
    pub recording_quality: Option<String>,
    pub recording_hotkey: Option<String>,
    pub custom_prompts: Option<Vec<CustomPrompt>>,
}

pub fn resolve_storage_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let settings = get_settings(app)?;
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

    let mut settings = get_settings(app)?;
    settings.storage_dir = Some(path.to_string_lossy().to_string());
    set_settings(app, settings)
}

pub fn create_new_recording(app: &tauri::AppHandle) -> Result<RecordingMetadata, String> {
    let created_at = Utc::now();
    let uuid = Uuid::new_v4();
    let id = format!("{}_{}", created_at.format("%Y-%m-%dT%H-%M-%SZ"), uuid);

    let audio_relative_path = format!("recordings/{id}/mic.mp3");
    let system_audio_relative_path = format!("recordings/{id}/system.mp3");
    let merged_audio_relative_path = format!("recordings/{id}/merged.mp3");

    // We always create paths for system and merged tracks during recording
    // to allow the backend to perform AEC and merging.
    // We clean up files in do_stop_recording if mode is "merged".
    let mic_info = RecordingAudioInfo {
        relative_path: audio_relative_path,
        duration_ms: None,
        format: "mp3".to_string(),
        sample_rate: 48_000,
        channels: 2,
    };
    let system_info = Some(RecordingAudioInfo {
        relative_path: system_audio_relative_path,
        duration_ms: None,
        format: "mp3".to_string(),
        sample_rate: 48_000,
        channels: 2,
    });
    let merged_info = Some(RecordingAudioInfo {
        relative_path: merged_audio_relative_path,
        duration_ms: None,
        format: "mp3".to_string(),
        sample_rate: 48_000,
        channels: 2,
    });

    let meta = RecordingMetadata {
        id: id.clone(),
        created_at,
        started_at: Some(created_at),
        title: None,
        audio_parts: vec![AudioSet {
            id,
            created_at,
            mic: mic_info,
            system: system_info,
            merged: merged_info,
        }],
        audio: None,
        system_audio: None,
        merged_audio: None,
        markdown_relative_path: None,
        notes: Some(Vec::new()),
    };

    save_recording_metadata(app, &meta)?;
    Ok(meta)
}

pub fn add_part_to_recording(app: &tauri::AppHandle, recording_id: &str) -> Result<RecordingMetadata, String> {
    let mut meta = load_recording_metadata(app, recording_id)?;
    let created_at = Utc::now();
    let part_id = Uuid::new_v4().to_string();
    
    let part_index = meta.audio_parts.len();
    let audio_relative_path = format!("recordings/{recording_id}/mic_{part_index}.mp3");
    let system_audio_relative_path = format!("recordings/{recording_id}/system_{part_index}.mp3");
    let merged_audio_relative_path = format!("recordings/{recording_id}/merged_{part_index}.mp3");

    let mic_info = RecordingAudioInfo {
        relative_path: audio_relative_path,
        duration_ms: None,
        format: "mp3".to_string(),
        sample_rate: 48_000,
        channels: 2,
    };
    let system_info = Some(RecordingAudioInfo {
        relative_path: system_audio_relative_path,
        duration_ms: None,
        format: "mp3".to_string(),
        sample_rate: 48_000,
        channels: 2,
    });
    let merged_info = Some(RecordingAudioInfo {
        relative_path: merged_audio_relative_path,
        duration_ms: None,
        format: "mp3".to_string(),
        sample_rate: 48_000,
        channels: 2,
    });

    meta.audio_parts.push(AudioSet {
        id: part_id,
        created_at,
        mic: mic_info,
        system: system_info,
        merged: merged_info,
    });

    save_recording_metadata(app, &meta)?;
    Ok(meta)
}

pub fn get_recording_mode(app: &tauri::AppHandle) -> Result<String, String> {
    let settings = get_settings(app)?;
    Ok(settings.recording_mode.unwrap_or_else(|| "merged".to_string()))
}

pub fn set_recording_mode(app: &tauri::AppHandle, mode: String) -> Result<(), String> {
    if mode != "merged" && mode != "separated" {
        return Err("Invalid recording mode".to_string());
    }
    let mut settings = get_settings(app)?;
    settings.recording_mode = Some(mode);
    set_settings(app, settings)
}

pub fn get_preferred_mic(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    let settings = get_settings(app)?;
    Ok(settings.preferred_mic_name)
}

pub fn set_preferred_mic(app: &tauri::AppHandle, name: Option<String>) -> Result<(), String> {
    let mut settings = get_settings(app)?;
    settings.preferred_mic_name = name;
    set_settings(app, settings)
}

pub fn get_recording_quality(app: &tauri::AppHandle) -> Result<String, String> {
    let settings = get_settings(app)?;
    Ok(settings.recording_quality.unwrap_or_else(|| "quality".to_string()))
}

pub fn set_recording_quality(app: &tauri::AppHandle, quality: &str) -> Result<(), String> {
    if quality != "quality" && quality != "size" {
        return Err("Invalid quality setting".to_string());
    }
    let mut settings = get_settings(app)?;
    settings.recording_quality = Some(quality.to_string());
    set_settings(app, settings)
}

pub fn get_recording_hotkey(app: &tauri::AppHandle) -> Result<String, String> {
    let settings = get_settings(app)?;
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
    let mut settings = get_settings(app)?;
    settings.recording_hotkey = Some(hotkey.to_string());
    set_settings(app, settings)
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

        let name = entry.file_name();
        let id = name.to_string_lossy();
        
        if let Ok(meta) = load_recording_metadata(app, &id) {
            out.push(meta);
        }
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
    let mut meta: RecordingMetadata = serde_json::from_slice(&bytes).map_err(|e| format!("Invalid metadata.json: {e}"))?;

    // Migration: if audio_parts is empty but we have old audio info, move it to audio_parts
    if meta.audio_parts.is_empty() {
        if let Some(mic) = meta.audio.clone() {
            meta.audio_parts.push(AudioSet {
                id: meta.id.clone(),
                created_at: meta.created_at,
                mic,
                system: meta.system_audio.clone(),
                merged: meta.merged_audio.clone(),
            });
        }
    }

    // Migration: if notes is None but we have a deprecated markdown path, move it to notes
    if meta.notes.is_none() {
        if let Some(rel) = meta.markdown_relative_path.clone() {
            meta.notes = Some(vec![RecordingNote {
                id: "default".to_string(),
                prompt_id: "meeting_notes".to_string(), // Assume default
                relative_path: rel,
                created_at: meta.created_at,
            }]);
        } else {
            meta.notes = Some(Vec::new());
        }
    }
    
    Ok(meta)
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

pub fn read_recording_note(app: &tauri::AppHandle, id: &str, note_id: Option<&str>) -> Result<String, String> {
    let meta = load_recording_metadata(app, id)?;
    
    let rel_path = if let Some(nid) = note_id {
        meta.notes.as_ref()
            .and_then(|notes| notes.iter().find(|n| n.id == nid))
            .map(|n| n.relative_path.clone())
            .ok_or_else(|| format!("Note with id {} not found", nid))?
    } else {
        meta.markdown_relative_path
            .clone()
            .ok_or("No default markdown note for this recording")?
    };

    let path = abs_path(app, &rel_path)?;
    if !path.exists() {
        return Ok(String::new());
    }
    std::fs::read_to_string(path).map_err(|e| format!("Failed to read note: {e}"))
}

pub fn save_recording_note(
    app: &tauri::AppHandle,
    id: &str,
    note_id: Option<&str>,
    content: &str,
) -> Result<(), String> {
    let meta = load_recording_metadata(app, id)?;
    
    let rel_path = if let Some(nid) = note_id {
        meta.notes.as_ref()
            .and_then(|notes| notes.iter().find(|n| n.id == nid))
            .map(|n| n.relative_path.clone())
            .ok_or_else(|| format!("Note with id {} not found", nid))?
    } else {
        meta.markdown_relative_path
            .clone()
            .ok_or("No default markdown note for this recording")?
    };

    let path = abs_path(app, &rel_path)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create note dir: {e}"))?;
    }
    std::fs::write(path, content).map_err(|e| format!("Failed to save note: {e}"))
}

pub fn delete_recording_note(
    app: &tauri::AppHandle,
    id: &str,
    note_id: &str,
) -> Result<(), String> {
    let mut meta = load_recording_metadata(app, id)?;
    
    let notes = meta.notes.as_mut().ok_or("Notes not initialized")?;
    let index = notes.iter().position(|n| n.id == note_id)
        .ok_or_else(|| format!("Note with id {} not found", note_id))?;
    
    let note = notes.remove(index);
    
    // Delete file
    let path = abs_path(app, &note.relative_path)?;
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| format!("Failed to delete note file: {e}"))?;
    }
    
    save_recording_metadata(app, &meta)
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

pub fn get_settings(app: &tauri::AppHandle) -> Result<Settings, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(Settings::default());
    }
    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read settings: {e}"))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("Invalid settings.json: {e}"))
}

pub fn set_settings(app: &tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings dir: {e}"))?;
    }
    let bytes = serde_json::to_vec_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| format!("Failed to write settings: {e}"))
}

// Gemini API key management
pub fn has_gemini_api_key(app: &tauri::AppHandle) -> Result<bool, String> {
    let settings = get_settings(app)?;
    Ok(settings
        .gemini_api_key
        .as_ref()
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false))
}

pub fn get_gemini_api_key(app: &tauri::AppHandle) -> Result<String, String> {
    let settings = get_settings(app)?;
    settings
        .gemini_api_key
        .filter(|k| !k.trim().is_empty())
        .ok_or_else(|| "Gemini API key is not set.".to_string())
}

pub fn set_gemini_api_key(app: &tauri::AppHandle, api_key: &str) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("Gemini API key must not be empty.".to_string());
    }
    let mut settings = get_settings(app)?;
    settings.gemini_api_key = Some(api_key.to_string());
    set_settings(app, settings)
}

pub fn clear_gemini_api_key(app: &tauri::AppHandle) -> Result<(), String> {
    let mut settings = get_settings(app)?;
    settings.gemini_api_key = None;
    set_settings(app, settings)
}

pub fn get_gemini_model(app: &tauri::AppHandle) -> Result<String, String> {
    let settings = get_settings(app)?;
    Ok(settings.gemini_model.unwrap_or_else(|| "gemini-3-flash-preview".to_string()))
}
