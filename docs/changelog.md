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

