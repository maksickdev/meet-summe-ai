export type RecordingAudioInfo = {
  relative_path: string;
  duration_ms: number | null;
  format: string;
  sample_rate: number;
  channels: number;
};

export type RecordingMetadata = {
  id: string;
  created_at: string;
  title: string | null;
  audio: RecordingAudioInfo;
  system_audio?: RecordingAudioInfo | null;
  merged_audio?: RecordingAudioInfo | null;
  markdown_relative_path: string | null;
};
