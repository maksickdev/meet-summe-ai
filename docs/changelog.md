## [2026-01-21] - Recording Timer & Status
### Added
- **Recording Timer**: Implemented a real-time timer in the Header showing the current recording duration in `HH:MM:SS` format.
- **Visual Status Indicators**: 
  - Pulsing red dot indicator when recording.
  - Solid amber dot indicator when paused.
- **Timer Logic**: Added robust timer state management in `App.tsx` to handle start, pause, resume, and stop events correctly, including external triggers from tray/shortcuts.

## [2026-01-20] - Recording Quality Settings
### Added
- **Recording Quality Options**: Added a setting to choose between "Quality Priority" (48kHz Stereo, 64kbps) and "Size Priority" (16kHz Mono, 32kbps).
  - "Size Priority" significantly reduces file size for voice-only recordings.
  - Implemented logic to handle different sample rates and channels in the recording backend.
  - Added frontend UI in `SettingsDialog` to select recording quality.
  - Updated IPC commands to support getting/setting quality preference.

## [2026-01-20] - Window Configuration & Branding
### Changed
- Set minimum window dimensions to 800x600 in `tauri.conf.json` to prevent layout issues.
- Replaced the raster logo in the Header with an animated SVG logo (`logo-motion.svg`) for better visual appeal.
- Increased header title font size to 38px for better brand visibility.

### Fixed
- Fixed TypeScript build errors (unused variables in `AudioPlayer.tsx` and `ConfirmDialog.tsx`).

## [2026-01-19] - UI Style Refinements
### Added
- **Radix UI Integration**: Migrated entire UI component library to use Radix UI primitives for accessible and robust interactions.
- **Custom UI Component Library**: Created a suite of reusable, styled components in `src/components/ui/` based on shadcn/ui patterns:
  - `Button`, `Input`, `Label`, `Select`, `Slider`, `Switch`, `Separator`
  - `Dialog`, `ScrollArea`, `ContextMenu`
- **Settings Dialog Refactor**: Complete rewrite of the Settings modal using `Dialog`, `Select`, `Switch`, and `Input` components for a polished look and feel.
- **Audio Player Refactor**: Redesigned Audio Player with custom controls using `Slider` and `Button` for seeking, play/pause, and volume/mute (replacing native HTML5 audio controls).

### Changed
- Replaced Header logo text with image asset.
- **Unified Design System**: Applied consistent styling across all dialogs, sidebars, and main content areas using the new component library.
- **Improved Sidebar**: Refactored Sidebar to use `ScrollArea` and `ContextMenu` for smoother scrolling and native-like interactions.
- **Enhanced Main Content**: Updated the main workspace to use `ScrollArea` for better content overflow handling.
- **Updated Header background color** to `zinc-900` (#18181b) in dark mode for better visual consistency.
- **Layout Refinements**: Adjusted global layout to allow more flexible status bar positioning and improved container sizing.
- **Sidebar Styling**: Updated background to `#101013`, added rounded corners (`8px`) and margins (`10px`) for a floating panel look.
- **Theme Enforcement**: Set `AppLayout` background to dark (`#101013`) to ensure consistent dark theme appearance.
- **Sidebar Cleanups**: Removed background from Sidebar header and ScrollArea to blend with the new container background.
- **Visual Polish**: Removed element borders and margins (Header, Sidebar, Footer) and added consistent global padding to AppLayout.
- **Refined Borders**: Adjusted Sidebar and AppLayout border radius to `8px` and fine-tuned borders and margins.
- **Sidebar Borders**: Added full border to Sidebar with consistent dark mode color (`zinc-800`) to improve separation from the background.

### Fixed
- Fixed an issue where the status bar was nested incorrectly within the layout hierarchy, moving it to the root level for better visibility and layout behavior.
- Fixed `AppLayout` background color to strictly use `zinc-900` (`#18181b`) matching the visual design.

## [2026-01-16] - Modern UI Redesign with Radix & Tailwind
### Added
- **New Layout Architecture**: Implemented a 3-pane layout (Sidebar, Header, MainContent) for better scalability and UX.
- **Settings Modal**: Moved configuration (Storage, Mic, API Key) to a dedicated `SettingsDialog` using Radix UI primitives.
- **Modern Components**: Added `Sidebar`, `Header`, `MainContent` components using Tailwind CSS v4 and Lucide icons.
- **Status Bar**: Added a status indicator in the Sidebar for system feedback.
- **Context Menu**: Added right-click context menu to recordings in the sidebar with "Rename" and "Delete" options.
- **Inline Renaming**: Implemented inline renaming of recordings directly in the sidebar.
- **Delete Confirmation**: Added a `ConfirmDialog` using Radix UI for safe deletion of recordings.

### Changed
- Refactored `App.tsx` to orchestrate the new layout components instead of containing all UI logic.
- Replaced the simple dropdown recording list with a scrollable Sidebar list featuring metadata (duration, date).
- Redesigned the Header to be a toolbar with recording controls and settings trigger.
- Improved MainContent area with better spacing and organization for Audio Player and Markdown Editor.
- Updated `storage/mod.rs` and `lib.rs` (backend) to support `rename_recording` and `delete_recording`.
- Updated `ipc.ts` (frontend) to expose new backend commands.

### Fixed
- Fixed audio writer warnings in Rust backend.
- Fixed a bug where `refreshRecordings` would auto-select the first recording even if one was already selected, due to stale closure variables in `useEffect`. Used `useRef` to track `selectedId` correctly.

## [2026-01-15] - Markdown Editor, Tray, Shortcuts, Merged Audio
### Added
- **Markdown Editor**: Integrated `react-markdown` + `remark-gfm` + `rehype-highlight` + `@tailwindcss/typography` for rich preview and editing of generated notes.
- **Tray Icon Support**: Added system tray icon with menu (Start, Stop, Quit) for background control.
- **Global Shortcuts**: Added global hotkey (`Cmd+Shift+R` on macOS, `Ctrl+Shift+R` on Win/Linux) to toggle recording.
- **Merged Audio Recording**: Added option to record a merged MP3 file (`mic + system`) on the fly, alongside separate tracks.
- **Settings**: Added toggle for "Merge audio files" in the UI.

### Changed
- Refactored `src/audio/recorder.rs` to support 3 parallel MP3 writers (mic, system, merged).
- Updated `RecordingMetadata` to include `merged_audio` track info.
- Added `read_recording_note` and `save_recording_note` commands to backend API.
- Updated `capabilities` to include `tray:default` and `global-shortcut:default` permissions.
- **Optimized Audio Storage**: Reduced MP3 bitrate from 192kbps to 64kbps to save disk space (~3x smaller files), which is sufficient for speech.

### Fixed
- **UI Synchronization**: Added backend events (`recording-started`, `recording-stopped`) to notify the frontend when recording is toggled via Tray Icon or Global Shortcut.
- **Recording List Refresh**: The UI now automatically refreshes the list of recordings when a background recording is stopped.
- **Microphone Preference**: The application now saves the last used microphone and uses it when recording is started via Tray/Hotkey (previously fell back to default device).

## [2026-01-14] - Project documentation bootstrap
### Added
- Initial project documentation: `docs/project.md`
- Initial changelog: `docs/changelog.md`
- Project overview for developers: `README.md`
- Scaffolded Tauri 2 + React TypeScript desktop app at `apps/desktop`
- Tailwind CSS (v4) baseline setup for the desktop UI (`apps/desktop`)
- Native Rust audio capture module (system output + microphone) with WAV writing (`apps/desktop/src-tauri/src/audio/*`)
- File-based recordings storage: per-recording directory layout + `metadata.json` (`apps/desktop/src-tauri/src/storage/*`)
- MVP React UI: recording controls, recordings list, and local playback (`apps/desktop/src/*`)
- Secure Gemini API key storage via OS keychain (Rust `keyring`) + settings UI (`apps/desktop/src-tauri/src/secrets.rs`, `apps/desktop/src/App.tsx`)
- Prompt templates for MVP summarization (`packages/prompts/*`)
- Gemini summarization UI with template selector and status feedback (`apps/desktop/src/App.tsx`)
- Complete audio-to-markdown pipeline: record → transcribe → summarize → save

### Changed
- Documented Gemini API key as an MVP requirement for summarization.
- Updated repository structure expectations now that `apps/desktop` exists.
- Updated Tauri app config: product name and bundle identifier.
- Added Rust dependencies for audio capture and buffering (`cpal`, `qruhear`, `ringbuf`, `hound`).
- Added Rust dependencies for recording metadata and stable IDs (`chrono`, `uuid`).
- Disabled DMG bundling by default to keep dev builds reliable (macOS bundle target: `app`).
- **Migrated API key storage from OS keychain to local settings.json** for better reliability and transparency
- Removed `keyring` dependency and `secrets.rs` module
- API key is now visible in the UI (stored in plain text for MVP simplicity)

### Fixed
- Fixed audio recording quality issues by standardizing sample rate to 48kHz for both system audio and microphone
- Fixed audio playback in the UI by adding `protocol-asset` feature and proper Tauri asset protocol configuration
- Removed unused `pick_mic_sample_rate` function and simplified sample rate selection logic
- Improved microphone configuration selection to prefer requested sample rate when available
- Enhanced API key management UI with validation, trimming, and status checking
- Improved feedback messages with visual indicators (✓/✗) for better UX
- Replaced file opening with "Show in Finder/Explorer" functionality using native OS commands
- Removed `tauri-plugin-opener` dependency in favor of direct system commands for better cross-platform support
- Fixed AudioPlayer not updating when switching between recordings by adding `useEffect` hook and `key` prop
- **Improved audio capture synchronization**: increased ring buffer sizes from 2s to 5s to prevent drops
- Added comprehensive debug logging to track system audio, microphone, and writer thread activity
- Added buffer overflow detection and warnings for both audio sources
- **Parallel multi-track recording**: Microphone and System Audio are now recorded to separate WAV files (`mic.wav` and `system.wav`) to avoid interference and synchronization issues
- Updated `RecordingMetadata` to support optional `system_audio` track
- Updated UI to display and play both Microphone and System Audio tracks separately
- Refactored `writer_loop` to handle multiple independent WAV writers concurrently
- **Replaced WAV with MP3 encoding**: Switched to `mp3lame-encoder` to reduce file size (~10x smaller)
- Implemented `Mp3StereoWriter` for efficient real-time MP3 encoding (192kbps)
- **Fixed macOS permissions**: Added `Info.plist` with `NSMicrophoneUsageDescription` and `NSScreenCaptureUsageDescription` to properly request access
- Note: Application must be built/bundled (`npm run tauri build`) to properly trigger macOS permission dialogs and appear in System Settings
