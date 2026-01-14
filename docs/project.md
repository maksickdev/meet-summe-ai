# SumMe — Project Documentation

## Purpose

SumMe is a lightweight, privacy-oriented, cross-platform desktop application that records **system audio + microphone** and produces **transcripts and structured summaries** using **Google Gemini**, exporting results into clean **Markdown** files.

## Goals

- Record system audio and microphone simultaneously with reliable A/V timing.
- Provide a minimal, fast UX: record → stop → summarize → preview/edit → export.
- Keep user data local by default (audio, metadata, generated markdown).
- Work in background: tray icon, global shortcuts, close-to-tray.
- Make summarization reproducible and configurable via prompt templates.
- Require a user-provided **Gemini API key** for summarization (no key → summarization disabled).

## Non-goals (MVP)

- Multi-user collaboration and shared workspaces.
- Cloud storage / syncing (optional post-1.0).
- Full semantic search across all notes (post-1.0).
- Calendar integrations (post-1.0).

## Target Tech Stack

- **Desktop framework**: Tauri 2.x
- **Frontend**: React 19 + TypeScript + Vite
- **UI**: shadcn/ui + Radix UI + Tailwind CSS
- **Markdown rendering**: `react-markdown` + `remark-gfm` + `rehype-highlight`
- **Audio capture (Rust)**: `cpal` + `ringbuf`
- **Gemini integration**: Rust (`reqwest`) or Node (`@google/generative-ai`) via IPC (decision recorded below)
- **Local storage**: filesystem + JSON metadata, optionally `tauri-plugin-store`
- **Hotkeys**: `tauri-plugin-global-shortcut`
- **Tray + notifications**: Tauri tray + notifications

## Architecture overview

SumMe uses a **Tauri** application shell:

- **Frontend (React)**: UI, player, list of recordings, markdown preview/editor, settings.
- **Backend (Rust)**: audio capture, encoding, filesystem operations, OS integrations (tray, shortcuts), Gemini requests (option A) or secure IPC bridge (option B).

### High-level components

- **Recording Engine (Rust)**: captures system output + microphone, mixes or stores separate streams, writes audio to disk.
- **Processing Pipeline**:
  - optional: audio normalization/splitting
  - upload audio or transcript to Gemini
  - post-process results into Markdown format
- **Metadata Store**: persistent index of recordings (JSON) + settings (store plugin or JSON).
- **UI Layer**: recording controls, status/progress, playback, preview, editing, export.
- **OS Integrations**: tray status, global shortcuts, notifications, auto-start (post-MVP).

### Data flow (record → summarize)

```mermaid
sequenceDiagram
  participant U as User
  participant UI as React UI
  participant BE as Tauri Rust Backend
  participant FS as Local Filesystem
  participant G as Google Gemini API

  U->>UI: Start recording
  UI->>BE: start_recording()
  BE->>BE: capture system+mic (ring buffer)
  U->>UI: Stop recording
  UI->>BE: stop_recording()
  BE->>FS: write audio file (.wav/.m4a)
  BE->>FS: write metadata (recording.json)
  U->>UI: Summarize with Gemini
  UI->>BE: summarize(recording_id, template)
  BE->>G: request transcript + summary
  G-->>BE: transcript + structured output
  BE->>FS: write markdown (.md)
  BE-->>UI: result (paths + preview)
  UI-->>U: Render markdown + allow edit/export
```

## Key decisions (initial)

### Gemini integration approach

Two viable options:

- **Option A (preferred for simplicity)**: Rust backend calls Gemini over HTTPS using `reqwest`.
  - Pros: single runtime, fewer moving parts, easier to secure.
  - Cons: need to manage auth and request formatting in Rust.

- **Option B**: Node client (`@google/generative-ai`) running in frontend tooling, invoked via Tauri IPC.
  - Pros: official JS client, easier SDK usage.
  - Cons: additional surface area, careful handling of API keys required.

**MVP default**: start with Option A unless SDK limitations appear.

### Storage format

- Audio stored as files in a user-selected base directory.
- Each recording has:
  - audio file
  - metadata JSON
  - generated Markdown summary

This keeps data portable and Obsidian-friendly.

## Data model (planned)

### Recording metadata (example)

```json
{
  "id": "2026-01-14T12-30-00Z_abc123",
  "createdAt": "2026-01-14T12:30:00Z",
  "title": "Weekly Sync",
  "language": "auto",
  "audio": {
    "path": "recordings/2026-01-14_weekly-sync/audio.wav",
    "durationMs": 3600000,
    "format": "wav",
    "sampleRate": 48000,
    "channels": 2
  },
  "processing": {
    "status": "idle",
    "lastRunAt": null,
    "template": "meeting_notes"
  },
  "outputs": {
    "markdownPath": "recordings/2026-01-14_weekly-sync/notes.md"
  }
}
```

### Settings (planned)

- Base storage directory
- Default language (auto/manual)
- Recording quality preset (low/medium/high)
- Gemini:
  - API key (required for summarization; stored securely; implementation-dependent)
  - model name
  - prompt template selection
- Global shortcuts mapping

## UI (MVP screens)

- **Home**:
  - start/pause/resume/stop buttons
  - recordings list
  - selected recording: player + summarize button
- **Recording state**:
  - timer
  - tray indicator: idle/recording/processing
- **Preview**:
  - markdown preview + basic editing
  - export/copy
- **Settings**:
  - storage folder
  - Gemini API key and templates
  - hotkeys

## Prompt templates

Templates are versioned assets with stable identifiers, e.g.:

- `meeting_notes`
- `lecture_notes`
- `brainstorming`
- `interview`

Each template should define:

- goal and tone
- required sections (summary, key points, action items)
- timestamp and speaker label handling instructions

## Error handling & UX rules

- Recording:
  - fail fast with actionable error messages (permissions, device not found)
  - never block UI thread
- Summarization:
  - show progress states (upload → processing → done)
  - cache last successful markdown output per recording
  - allow re-run with a different template

## Security & privacy

- Data is stored locally by default.
- Summarization requires a user-provided Gemini API key.
- API keys must never be logged.
- API keys should be stored using the most secure OS mechanism available (implementation-dependent).
- Telemetry is off by default (MVP: none).
- Clearly communicate that summarization sends data to Gemini.

## OS-specific considerations

- **macOS**: system audio capture may require "Screen Recording" permission.
- **Windows**: loopback capture generally available; edge cases may need virtual audio devices.
- **Linux**: PulseAudio vs PipeWire differences; test on major distros.

## Risks & mitigations

- **System audio access complexity**: implement per-OS capture strategy; document required permissions.
- **Gemini cost**: show token/usage estimates and provide limits.
- **Transcript quality**: offer multiple templates and re-generation.
- **Bundle size**: keep dependencies minimal; leverage Tauri.

## Roadmap (high level)

- **MVP**: recording + summarize + markdown output + tray/hotkeys
- **1.0**: quality presets, language selection, templates UI, export integrations, theming, notifications
- **Post-1.0**: search, tags/projects, cloud mode, team features, calendar integrations, mobile

