import { invoke } from "@tauri-apps/api/core";

import type { RecordingMetadata } from "./types/recording";

export async function greet(name: string): Promise<string> {
  return await invoke<string>("greet", { name });
}

export async function getStorageDir(): Promise<string> {
  return await invoke<string>("get_storage_dir");
}

export async function setStorageDir(path: string): Promise<void> {
  await invoke<void>("set_storage_dir", { path });
}

export async function listRecordings(): Promise<RecordingMetadata[]> {
  return await invoke<RecordingMetadata[]>("list_recordings");
}

export async function getRecording(recordingId: string): Promise<RecordingMetadata> {
  return await invoke<RecordingMetadata>("get_recording", { recordingId });
}

export async function deleteRecording(recordingId: string): Promise<void> {
  await invoke<void>("delete_recording", { recordingId });
}

export async function renameRecording(recordingId: string, newTitle: string): Promise<void> {
  await invoke<void>("rename_recording", { recordingId, newTitle });
}

export async function listInputDevices(): Promise<string[]> {
  return await invoke<string[]>("list_input_devices");
}

export async function hasGeminiApiKey(): Promise<boolean> {
  return await invoke<boolean>("has_gemini_api_key");
}

export async function getGeminiApiKey(): Promise<string> {
  return await invoke<string>("get_gemini_api_key");
}

export async function setGeminiApiKey(apiKey: string): Promise<void> {
  await invoke<void>("set_gemini_api_key", { apiKey });
}

export async function clearGeminiApiKey(): Promise<void> {
  await invoke<void>("clear_gemini_api_key");
}

export async function startRecording(micDeviceName: string | null): Promise<RecordingMetadata> {
  return await invoke<RecordingMetadata>("start_recording", { micDeviceName });
}

export async function pauseRecording(): Promise<void> {
  await invoke<void>("pause_recording");
}

export async function resumeRecording(): Promise<void> {
  await invoke<void>("resume_recording");
}

export async function stopRecording(): Promise<RecordingMetadata> {
  return await invoke<RecordingMetadata>("stop_recording");
}

export async function summarizeRecording(
  recordingId: string,
  templateId: string,
): Promise<RecordingMetadata> {
  return await invoke<RecordingMetadata>("summarize_recording", { recordingId, templateId });
}

export async function readRecordingNote(recordingId: string): Promise<string> {
  return await invoke<string>("read_recording_note", { recordingId });
}

export async function saveRecordingNote(recordingId: string, content: string): Promise<void> {
  await invoke<void>("save_recording_note", { recordingId, content });
}

export async function showInFolder(path: string): Promise<void> {
  await invoke<void>("show_in_folder", { path });
}

export async function getMergeAudioFiles(): Promise<boolean> {
  return await invoke<boolean>("get_merge_audio_files");
}

export async function setMergeAudioFiles(enabled: boolean): Promise<void> {
  await invoke<void>("set_merge_audio_files", { enabled });
}

export async function getPreferredMic(): Promise<string | null> {
  return await invoke<string | null>("get_preferred_mic");
}

export async function setPreferredMic(name: string | null): Promise<void> {
  await invoke<void>("set_preferred_mic", { name });
}

export async function getRecordingQuality(): Promise<string> {
  return await invoke<string>("get_recording_quality");
}

export async function setRecordingQuality(quality: string): Promise<void> {
  await invoke<void>("set_recording_quality", { quality });
}
