# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**summe** (Summerizer) — a private, cross-platform desktop app built with Tauri 2.x. It records system audio + microphone simultaneously and generates transcripts/summaries via Google Gemini, outputting clean Markdown files.

## Commands

All development happens inside `apps/desktop/`:

```bash
cd apps/desktop

# Install frontend dependencies
npm install

# Run in dev mode (starts Rust backend + Vite frontend)
npm run tauri dev

# Production build
npm run tauri build

# Frontend only (Vite)
npm run dev
npm run build
```

There are no test commands configured yet.

## Architecture

The app uses Tauri's IPC bridge: the **React frontend** calls **Rust commands** via `invoke()`.

### Frontend (`apps/desktop/src/`)

- **`ipc.ts`** — single source of truth for all Tauri `invoke()` calls. Every IPC command has a typed wrapper here.
- **`types/recording.ts`** — shared TypeScript types: `RecordingMetadata`, `AudioSet`, `RecordingNote`, `CustomPrompt`.
- **`App.tsx`** — top-level state management: selected recording, recording status, UI mode.
- **`components/`** — flat list of feature components (`Header`, `Sidebar`, `MainContent`, `SettingsDialog`, `AudioPlayer`, `MarkdownEditor`, etc.) + `ui/` for Radix UI primitives.
- **`lib/utils.ts`** — `cn()` helper (clsx + tailwind-merge).

UI stack: React 19 + TypeScript + Tailwind CSS v4 + Radix UI primitives.

### Rust Backend (`apps/desktop/src-tauri/src/`)

Three modules, each with a `mod.rs`:

- **`audio/`** — audio capture pipeline:
  - `device.rs` — enumerate input devices via `cpal`
  - `recorder.rs` — `RecordingSession`: captures mic (`cpal`) + system audio (`qruhear`), applies AEC via `webrtc-audio-processing`, buffers with `ringbuf`
  - `writer.rs` — encodes PCM → MP3 using `mp3lame-encoder`
- **`gemini/`** — Gemini API client (Rust `reqwest`): uploads audio, requests transcript + summary, emits progress events to UI
- **`storage/`** — filesystem and JSON metadata: `RecordingMetadata`, `settings.json` (storage dir, API key, hotkey, quality, recording mode, preferred mic)
- **`lib.rs`** — Tauri app entry: registers all `#[tauri::command]` handlers, `AppState` (wraps active recording session + tray + shortcuts), tray menu setup, global shortcut registration/re-registration

`AppState` uses `parking_lot::Mutex` for the active recording and tray, and `Arc<AtomicBool>` for `is_recording`.

### IPC Event Flow

Frontend subscribes to Tauri events emitted from Rust:
- `recording-stopped` — fired after `stop_recording()`
- `summarize-status` — `SummarizeStatusPayload { stage, message, part_index, part_total }` — granular progress during summarization

### Data Storage

All data is local. Each recording is stored as:
```
<storage_dir>/recordings/<id>/
  mic.mp3              # microphone track
  system.mp3           # system audio (optional)
  merged.mp3           # merged track (optional)
  recording.json       # RecordingMetadata
  notes_<uuid>.md      # generated Markdown notes (one per prompt run)
```

Settings stored at Tauri `app_data_dir` as `settings.json`. Log file: `app_data_dir/logs/summerizer.log`.

### Prompt Templates

Versioned `.txt` files in `packages/prompts/`: `meeting_notes`, `lecture_notes`, `brainstorming`, `interview`. Custom prompts can also be created/edited from the UI and are persisted in `settings.json`.

## Key Development Rules

- All code comments must be in **English**.
- All documentation files (`/docs/`, `README.md`) must be in **English**.
- After implementing new functionality, update `/docs/changelog.md` and `/docs/project.md`.
- Communicate with the user in **Russian**.
- Follow SOLID, KISS, DRY — remove unused code and dead comments.
- `reqwest` is used with `rustls-tls` (no native TLS); Gemini API calls are made directly from Rust, not from the frontend.
- Global shortcuts use `tauri-plugin-global-shortcut`; re-registration calls `unregister_all()` first to avoid duplicates.
