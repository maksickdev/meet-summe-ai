import { useEffect, useMemo, useState } from "react";

import {
  clearGeminiApiKey,
  getGeminiApiKey,
  getStorageDir,
  hasGeminiApiKey,
  listInputDevices,
  listRecordings,
  pauseRecording,
  resumeRecording,
  setGeminiApiKey,
  setStorageDir,
  showInFolder,
  startRecording,
  stopRecording,
  summarizeRecording,
} from "./ipc";
import { AudioPlayer } from "./components/AudioPlayer";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { RecordingControls } from "./components/RecordingControls";
import { RecordingsList } from "./components/RecordingsList";
import type { RecordingMetadata } from "./types/recording";

function joinPaths(base: string, relative: string): string {
  const b = base.replace(/\/+$/, "");
  const r = relative.replace(/^\/+/, "");
  if (!b) return `/${r}`;
  return `${b}/${r}`;
}

export default function App() {
  const [storageDir, setStorageDirState] = useState<string>("");
  const [storageDirDraft, setStorageDirDraft] = useState<string>("");
  const [devices, setDevices] = useState<string[]>([]);
  const [micDevice, setMicDevice] = useState<string>("");
  const [recordings, setRecordings] = useState<RecordingMetadata[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  const [recState, setRecState] = useState<"idle" | "recording" | "paused">("idle");
  const [status, setStatus] = useState<string>("");

  const [hasKey, setHasKey] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("meeting_notes");
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);

  const selected = useMemo(
    () => recordings.find((r) => r.id === selectedId) ?? null,
    [recordings, selectedId],
  );

  const selectedAbsAudioPath = useMemo(() => {
    if (!selected) return "";
    return joinPaths(storageDir, selected.audio.relative_path);
  }, [selected, storageDir]);

  const selectedAbsSystemAudioPath = useMemo(() => {
    if (!selected || !selected.system_audio) return "";
    return joinPaths(storageDir, selected.system_audio.relative_path);
  }, [selected, storageDir]);

  async function refreshRecordings() {
    const list = await listRecordings();
    setRecordings(list);
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }

  useEffect(() => {
    Promise.all([getStorageDir(), listRecordings(), listInputDevices(), hasGeminiApiKey()])
      .then(async ([dir, recs, devs, keyPresent]) => {
        setStorageDirState(dir);
        setStorageDirDraft(dir);
        setRecordings(recs);
        setDevices(devs);
        setHasKey(keyPresent);
        if (keyPresent) {
          try {
            const key = await getGeminiApiKey();
            setApiKey(key);
          } catch {
            setApiKey("");
          }
        }
        if (recs[0]) setSelectedId(recs[0].id);
      })
      .catch((e) => setStatus(String(e)));
  }, []);

  async function onSaveStorage() {
    setStatus("");
    try {
      await setStorageDir(storageDirDraft);
      const dir = await getStorageDir();
      setStorageDirState(dir);
      setStorageDirDraft(dir);
      await refreshRecordings();
      setStatus("Storage directory saved.");
    } catch (e) {
      setStatus(`Storage error: ${String(e)}`);
    }
  }

  async function onSaveApiKey() {
    setStatus("");
    const key = apiKey.trim();
    if (!key) {
      setStatus("API key cannot be empty.");
      return;
    }
    try {
      await setGeminiApiKey(key);
      const keyPresent = await hasGeminiApiKey();
      setHasKey(keyPresent);
      setStatus(`Gemini API key saved successfully! ✓`);
    } catch (e) {
      setStatus(`Gemini key error: ${String(e)}`);
    }
  }

  async function onClearApiKey() {
    setStatus("");
    try {
      await clearGeminiApiKey();
      setHasKey(false);
      setApiKey("");
      setStatus("Gemini API key cleared.");
    } catch (e) {
      setStatus(`Gemini key error: ${String(e)}`);
    }
  }

  async function onStart() {
    setStatus("");
    try {
      const meta = await startRecording(micDevice || null);
      setRecState("recording");
      setSelectedId(meta.id);
      setStatus("Recording started.");
    } catch (e) {
      setStatus(`Start error: ${String(e)}`);
    }
  }

  async function onPause() {
    setStatus("");
    try {
      await pauseRecording();
      setRecState("paused");
      setStatus("Recording paused.");
    } catch (e) {
      setStatus(`Pause error: ${String(e)}`);
    }
  }

  async function onResume() {
    setStatus("");
    try {
      await resumeRecording();
      setRecState("recording");
      setStatus("Recording resumed.");
    } catch (e) {
      setStatus(`Resume error: ${String(e)}`);
    }
  }

  async function onStop() {
    setStatus("");
    try {
      const meta = await stopRecording();
      setRecState("idle");
      await refreshRecordings();
      setSelectedId(meta.id);
      setStatus("Recording saved.");
    } catch (e) {
      setStatus(`Stop error: ${String(e)}`);
    }
  }

  async function onShowInFolder() {
    setStatus("");
    try {
      if (!selectedAbsAudioPath) {
        setStatus("No audio file selected.");
        return;
      }
      await showInFolder(selectedAbsAudioPath);
      setStatus("Opened in file manager.");
    } catch (e) {
      setStatus(`Open error: ${String(e)}`);
    }
  }

  async function onSummarize() {
    setStatus("");
    if (!selected) {
      setStatus("No recording selected.");
      return;
    }
    if (!hasKey) {
      setStatus("Gemini API key not set. Please configure it in settings.");
      return;
    }
    setIsSummarizing(true);
    try {
      setStatus("Summarizing with Gemini...");
      const updated = await summarizeRecording(selected.id, templateId);
      await refreshRecordings();
      setSelectedId(updated.id);
      setStatus("Summarization complete! Markdown saved.");
    } catch (e) {
      setStatus(`Summarize error: ${String(e)}`);
    } finally {
      setIsSummarizing(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">SumMe</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            MVP: record system audio + microphone, store locally, then summarize with Gemini.
          </p>
        </header>

        <section className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Storage
              </div>
              <div className="mt-2 break-all font-mono text-sm">{storageDir || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Microphone
              </div>
              <div className="mt-2">
                <select
                  value={micDevice}
                  onChange={(e) => setMicDevice(e.currentTarget.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                >
                  <option value="">Not set (system audio only)</option>
                  {devices.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={storageDirDraft}
              onChange={(e) => setStorageDirDraft(e.currentTarget.value)}
              placeholder="/absolute/path"
              className="w-full flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <button
              type="button"
              onClick={() => {
                onSaveStorage().catch(() => {});
              }}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save storage
            </button>
          </div>

          <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            Storage directory must be an absolute path. If empty, the app uses its default app data directory.
          </div>

          <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Gemini API key</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Status: {hasKey ? "✓ set" : "✗ not set"}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.currentTarget.value)}
                placeholder="Paste your Gemini API key"
                type="text"
                className="w-full flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
              <button
                type="button"
                onClick={() => {
                  onSaveApiKey().catch(() => {});
                }}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Save key
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearApiKey().catch(() => {});
                }}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
              >
                Clear key
              </button>
            </div>
            <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              The key is stored locally in settings.json and visible in the UI for convenience.
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <RecordingControls state={recState} onStart={onStart} onPause={onPause} onResume={onResume} onStop={onStop} />
          <RecordingsList recordings={recordings} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        {selected ? (
          <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Selected recording</div>
              <button
                type="button"
                onClick={() => {
                  onShowInFolder().catch(() => {});
                }}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
              >
                Show in Finder
              </button>
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 text-sm">
                <div className="font-mono">{selected.id}</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">Created: {selected.created_at}</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">Audio (Mic): {selected.audio.relative_path}</div>
                {selected.system_audio && (
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Audio (System): {selected.system_audio.relative_path}</div>
                )}
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Duration: {selected.audio.duration_ms ? `${Math.round(selected.audio.duration_ms / 1000)}s` : "—"}
                </div>
              </div>

              <div className="space-y-4">
                {selectedAbsAudioPath ? (
                  <div>
                    <div className="mb-1 text-xs font-medium text-zinc-500">Microphone</div>
                    <AudioPlayer absolutePath={selectedAbsAudioPath} />
                  </div>
                ) : null}
                {selectedAbsSystemAudioPath ? (
                  <div>
                    <div className="mb-1 text-xs font-medium text-zinc-500">System Audio</div>
                    <AudioPlayer absolutePath={selectedAbsSystemAudioPath} />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Summarize with Gemini</div>
                {!hasKey && (
                  <div className="text-xs text-amber-600 dark:text-amber-400">⚠ API key required</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.currentTarget.value)}
                  className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                >
                  <option value="meeting_notes">Meeting Notes</option>
                  <option value="lecture_notes">Lecture Notes</option>
                  <option value="brainstorming">Brainstorming Session</option>
                  <option value="interview">Interview</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    onSummarize().catch(() => {});
                  }}
                  disabled={isSummarizing || !hasKey}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {isSummarizing ? "Processing..." : "Summarize"}
                </button>
              </div>
              
              <div className="mt-4">
                <MarkdownEditor
                  recordingId={selected.id}
                  initialPath={selected.markdown_relative_path || ""}
                />
              </div>
            </div>
          </section>
        ) : null}

        {status ? (
          <section className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {status}
          </section>
        ) : null}
      </div>
    </div>
  );
}
