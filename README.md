# SumMe (Summerizer)

Private, cross-platform desktop app to **record system audio + microphone** and generate **high-quality transcripts and summaries** using **Google Gemini**, exported as beautiful **Markdown**.

> **Status**: MVP complete. Features: Native Rust audio capture (System + Mic) with MP3 encoding, real-time merging, Tray icon & Global shortcuts, Markdown preview & editor, Gemini summarization.

## Key Features

- **Record Everything**: System audio + Microphone simultaneously.
- **High Quality**: 48kHz sampling, MP3 encoding (64kbps optimized for speech).
- **Flexible**: Record separate tracks or merge them on the fly.
- **Background Control**: System Tray icon and Global Hotkey (`Cmd+Shift+R` / `Ctrl+Shift+R`).
- **AI Powered**: Summarize recordings with Google Gemini using custom templates.
- **Notes**: Read and edit generated Markdown notes directly in the app.
- **Privacy First**: All data stored locally. API keys stored in local settings.

## Tech Stack

- **Desktop**: Tauri 2.x (Rust backend)
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Audio**: `cpal` + `qruhear` (capture), `ringbuf` (buffer), `mp3lame-encoder` (MP3 encoding)
- **AI**: Google Gemini API (via Rust `reqwest`)
- **OS Integration**: Tray menu, Global shortcuts, File system access

## Documentation

- Product requirements: `docs/prd.md`
- Architecture & decisions: `docs/project.md`
- Change log: `docs/changelog.md`

## Development

Desktop app development happens in `apps/desktop`.

### Prerequisites

- Node.js (LTS recommended)
- Rust toolchain (`rustup`, stable)
- System dependencies (e.g., `libmp3lame` might be needed on Linux, on macOS/Windows it's usually bundled or static)

### Install dependencies

```bash
cd apps/desktop
npm install
```

### Run (dev)

```bash
cd apps/desktop
npm run tauri dev
```

### Build (release)

```bash
cd apps/desktop
npm run tauri build
```
