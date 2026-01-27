export type RecordingAudioInfo = {
  relative_path: string;
  duration_ms: number | null;
  format: string;
  sample_rate: number;
  channels: number;
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
  title: string | null;
  audio: RecordingAudioInfo;
  system_audio?: RecordingAudioInfo | null;
  merged_audio?: RecordingAudioInfo | null;
  markdown_relative_path: string | null; // Deprecated
  notes?: RecordingNote[] | null;
};

export type CustomPrompt = {
  id: string;
  name: string;
  content: string;
};
