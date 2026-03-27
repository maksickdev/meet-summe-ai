export type RecordingAudioInfo = {
  relative_path: string;
  duration_ms: number | null;
  format: string;
  sample_rate: number;
  channels: number;
};

export type AudioSet = {
  id: string; // Unique ID for this part
  created_at: string;
  mic: RecordingAudioInfo;
  system?: RecordingAudioInfo | null;
  merged?: RecordingAudioInfo | null;
};

export type RecordingNote = {
  id: string;
  prompt_id: string;
  relative_path: string;
  created_at: string;
};

export type RecordingMetadata = {
  id: string;
  created_at: string;
  started_at?: string | null;
  title: string | null;
  audio_parts: AudioSet[]; // Support for multiple parts
  notes?: RecordingNote[] | null;

  // Deprecated fields kept for reading old recordings only
  audio?: RecordingAudioInfo;
  system_audio?: RecordingAudioInfo | null;
  merged_audio?: RecordingAudioInfo | null;
  markdown_relative_path?: string | null;
};

export type CustomPrompt = {
  id: string;
  name: string;
  content: string;
};
