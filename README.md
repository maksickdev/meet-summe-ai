# SumMe (Summerizer)

Private, cross-platform desktop app to **record system audio + microphone** and generate **high-quality transcripts and summaries** using **Google Gemini**, exported as beautiful **Markdown**.

> **Status**: MVP core functionality implemented. Native Rust audio capture (system + microphone) with 48kHz standardized quality, file-based storage, React UI with playback, and Gemini API integration ready.
>
> **Known issues fixed**: Audio quality artifacts resolved by standardizing sample rates. Audio playback now works correctly via Tauri asset protocol.

## What it does (MVP)

- Record **system audio + microphone** simultaneously (loopback)
- Pause / resume / stop
- Save audio as `.m4a` / `.wav` / `.mp3` (final format TBD)
- One click: **“Summarize with Gemini”** → transcript + summary + action items
- Enter and use a personal **Gemini API key** (required for summarization)
- Auto-save results to Markdown (timestamps, speaker labels when available)
- Runs in background: **tray icon**, global hotkeys, close-to-tray behavior
- Simple UI: list of recordings, player, summarize button

## Tech stack (target)

- **Desktop**: Tauri 2.x (Rust backend)
- **Frontend**: React 19 + TypeScript + Vite
- **UI**: shadcn/ui + Radix UI + Tailwind CSS
- **Markdown**: `react-markdown` + `remark-gfm` + `rehype-highlight`
- **Audio capture (Rust)**: system output via `qruhear` + microphone via `cpal` (buffering via `ringbuf`, WAV via `hound`)
- **Gemini**: `@google/generative-ai` via IPC or Rust `reqwest` (final choice TBD)
- **Local storage**: filesystem + metadata JSON, optionally `tauri-plugin-store`
- **Shortcuts / tray / notifications**: Tauri plugins and built-ins

## Privacy & data

- The app is designed to store recordings and notes **locally**.
- When summarizing, audio (or extracted transcript) is sent to **Gemini** according to the selected integration approach.
- Future roadmap may include optional cloud backup and SaaS features.

## Documentation

- Product requirements: `docs/prd.md`
- Architecture & decisions: `docs/project.md`
- Change log: `docs/changelog.md`

## Planned repository structure (preview)

This is the intended layout as implementation progresses:

```text
.
├─ apps/
│  └─ desktop/                 # Tauri app (Rust + React)
│     ├─ src/                  # React UI
│     └─ src-tauri/            # Rust backend
├─ packages/
│  ├─ shared/                  # Shared types/utilities
│  └─ prompts/                 # Prompt templates and versions
├─ docs/
│  ├─ prd.md
│  ├─ project.md
│  └─ changelog.md
└─ README.md
```

## Development (placeholder)

Desktop app development happens in `apps/desktop`.

### Prerequisites

- Node.js (LTS recommended)
- Rust toolchain (`rustup`, stable)

### Install dependencies

```bash
cd apps/desktop
npm install
```

### Run (desktop)

```bash
cd apps/desktop
npm run tauri dev
```


