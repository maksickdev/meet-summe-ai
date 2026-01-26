import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useState, useRef } from "react";

import {
  clearGeminiApiKey,
  getGeminiApiKey,
  getRecordingMode,
  getPreferredMic,
  getStorageDir,
  hasGeminiApiKey,
  listInputDevices,
  listRecordings,
  deleteRecording,
  renameRecording,
  pauseRecording,
  resumeRecording,
  setGeminiApiKey,
  setRecordingMode,
  setPreferredMic,
  setStorageDir,
  showInFolder,
  startRecording,
  stopRecording,
  summarizeRecording,
  getRecordingQuality,
  setRecordingQuality,
  getRecordingHotkey,
  setRecordingHotkey,
} from "./ipc";

import type { RecordingMetadata } from "./types/recording";

import { AppLayout } from "./components/AppLayout";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { MainContent } from "./components/MainContent";
import { SettingsDialog } from "./components/SettingsDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";

function joinPaths(base: string, relative: string): string {
  const b = base.replace(/\/+$/, "");
  const r = relative.replace(/^\/+/, "");
  if (!b) return `/${r}`;
  return `${b}/${r}`;
}

export default function App() {
  // --- State ---
  const [storageDir, setStorageDirState] = useState<string>("");
  const [storageDirDraft, setStorageDirDraft] = useState<string>("");
  const [devices, setDevices] = useState<string[]>([]);
  const [micDevice, setMicDevice] = useState<string>("");
  const [recordings, setRecordings] = useState<RecordingMetadata[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const [recState, setRecState] = useState<"idle" | "recording" | "paused">("idle");
  const [status, setStatus] = useState<string>(""); // Kept for debugging/toasts if needed later

  // --- Timer State ---
  const [startTime, setStartTime] = useState<number | null>(null);
  const [accumulatedDuration, setAccumulatedDuration] = useState<number>(0);

  const [hasKey, setHasKey] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("meeting_notes");
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [recordingMode, setRecordingModeState] = useState<string>("merged");
  const [recordingQuality, setRecordingQualityState] = useState<string>("quality");
  const [hotkey, setHotkeyState] = useState<string>("");
  const [hotkeyDraft, setHotkeyDraft] = useState<string>("");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Derived State ---
  const selected = useMemo(
    () => recordings.find((r) => r.id === selectedId) ?? null,
    [recordings, selectedId],
  );

  const selectedAbsAudioPath = useMemo(() => {
    if (!selected) return "";
    return joinPaths(storageDir, selected.audio.relative_path);
  }, [selected, storageDir]);

  // --- Effects ---
  async function refreshRecordings() {
    const list = await listRecordings();
    setRecordings(list);
    // If we have no selected ID but we have recordings, select the first one
    if (!selectedIdRef.current && list.length > 0) {
      setSelectedId(list[0].id);
    }
  }

  useEffect(() => {
    Promise.all([
      getStorageDir(),
      listRecordings(),
      listInputDevices(),
      hasGeminiApiKey(),
      getRecordingMode(),
      getPreferredMic(),
      getRecordingQuality(),
      getRecordingHotkey(),
    ])
      .then(async ([dir, recs, devs, keyPresent, mode, prefMic, quality, hk]) => {
        setStorageDirState(dir);
        setStorageDirDraft(dir);
        setRecordings(recs);
        setDevices(devs);
        setHasKey(keyPresent);
        setRecordingModeState(mode);
        setRecordingQualityState(quality);
        setHotkeyState(hk);
        setHotkeyDraft(hk);
        if (prefMic) {
          setMicDevice(prefMic);
        }
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

    // Listen for backend events (tray/hotkey)
    let unlisten: (() => void)[] = [];
    let unmounted = false;

    Promise.all([
      listen<RecordingMetadata>("recording-started", (event) => {
        console.log("External start", event);
        setRecState("recording");
        setSelectedId(event.payload.id);
        setStatus("Recording started (external).");
        // External start - we might not have exact sync but we can start counting
        setStartTime(Date.now());
        setAccumulatedDuration(0);
      }),
      listen<RecordingMetadata>("recording-stopped", (event) => {
        console.log("External stop", event);
        setRecState("idle");
        refreshRecordings().then(() => {
          setSelectedId(event.payload.id);
          setStatus("Recording stopped (external).");
          setStartTime(null);
          setAccumulatedDuration(0);
        });
      }),
    ]).then((unlisteners) => {
      if (unmounted) {
        unlisteners.forEach((f) => f());
      } else {
        unlisten = unlisteners;
      }
    });

    return () => {
      unmounted = true;
      unlisten.forEach((f) => f());
    };
  }, []);

  // --- Handlers ---

  async function onChangeRecordingMode(mode: string) {
    setRecordingModeState(mode);
    try {
      await setRecordingMode(mode);
    } catch (e) {
      console.error(e);
      setStatus(`Error saving recording mode: ${String(e)}`);
    }
  }

  async function onChangeQuality(quality: string) {
    setRecordingQualityState(quality);
    try {
      await setRecordingQuality(quality);
    } catch (e) {
      console.error(e);
      setStatus(`Error saving quality setting: ${String(e)}`);
    }
  }

  async function onChangeMic(name: string) {
    setMicDevice(name);
    try {
      await setPreferredMic(name || null);
    } catch (e) {
      console.error(e);
      setStatus(`Error saving mic preference: ${String(e)}`);
    }
  }

  async function onSaveHotkey() {
    try {
      await setRecordingHotkey(hotkeyDraft);
      const ok = await getRecordingHotkey();
      setHotkeyState(ok);
      setHotkeyDraft(ok);
      setStatus("Global shortcut updated.");
    } catch (e) {
      console.error(e);
      setStatus(`Hotkey error: ${String(e)}`);
    }
  }

  async function onSaveStorage() {
    try {
      await setStorageDir(storageDirDraft);
      const dir = await getStorageDir();
      setStorageDirState(dir);
      setStorageDirDraft(dir);
      await refreshRecordings();
      setStatus("Storage directory saved.");
    } catch (e) {
      console.error(e);
      setStatus(`Storage error: ${String(e)}`);
    }
  }

  async function onSaveApiKey() {
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
      console.error(e);
      setStatus(`Gemini key error: ${String(e)}`);
    }
  }

  async function onClearApiKey() {
    try {
      await clearGeminiApiKey();
      setHasKey(false);
      setApiKey("");
      setStatus("Gemini API key cleared.");
    } catch (e) {
      console.error(e);
      setStatus(`Gemini key error: ${String(e)}`);
    }
  }

  async function onStart() {
    try {
      const meta = await startRecording(micDevice || null);
      setRecState("recording");
      setSelectedId(meta.id);
      setStatus("Recording started.");
      setStartTime(Date.now());
      setAccumulatedDuration(0);
    } catch (e) {
      console.error(e);
      setStatus(`Start error: ${String(e)}`);
    }
  }

  async function onPause() {
    try {
      await pauseRecording();
      setRecState("paused");
      setStatus("Recording paused.");
      if (startTime) {
        setAccumulatedDuration((prev) => prev + (Date.now() - startTime));
        setStartTime(null);
      }
    } catch (e) {
      console.error(e);
      setStatus(`Pause error: ${String(e)}`);
    }
  }

  async function onResume() {
    try {
      await resumeRecording();
      setRecState("recording");
      setStatus("Recording resumed.");
      setStartTime(Date.now());
    } catch (e) {
      console.error(e);
      setStatus(`Resume error: ${String(e)}`);
    }
  }

  async function onStop() {
    try {
      const meta = await stopRecording();
      setRecState("idle");
      await refreshRecordings();
      setSelectedId(meta.id);
      setStatus("Recording saved.");
      setStartTime(null);
      setAccumulatedDuration(0);
    } catch (e) {
      console.error(e);
      setStatus(`Stop error: ${String(e)}`);
    }
  }

  async function onShowInFolder() {
    try {
      if (!selectedAbsAudioPath) {
        setStatus("No audio file selected.");
        return;
      }
      await showInFolder(selectedAbsAudioPath);
    } catch (e) {
      console.error(e);
      setStatus(`Open error: ${String(e)}`);
    }
  }

  async function onDelete(id: string) {
    setRecordingToDelete(id);
    setDeleteConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!recordingToDelete) return;
    setIsDeleting(true);
    try {
      await deleteRecording(recordingToDelete);
      if (selectedId === recordingToDelete) {
        setSelectedId("");
      }
      await refreshRecordings();
      setStatus("Recording deleted.");
      setDeleteConfirmOpen(false);
      setRecordingToDelete(null);
    } catch (e) {
      console.error(e);
      setStatus(`Delete error: ${String(e)}`);
    } finally {
      setIsDeleting(false);
    }
  }

  async function onRename(id: string, newTitle: string) {
    try {
      await renameRecording(id, newTitle);
      await refreshRecordings();
      setStatus("Recording renamed.");
    } catch (e) {
      console.error(e);
      setStatus(`Rename error: ${String(e)}`);
    }
  }

  async function onSummarize() {
    if (!selected) return;
    if (!hasKey) {
      setIsSettingsOpen(true);
      setStatus("Please configure Gemini API key first.");
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
      console.error(e);
      setStatus(`Summarize error: ${String(e)}`);
    } finally {
      setIsSummarizing(false);
    }
  }

  // --- Render ---

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-2xl">
      <Header
        recState={recState}
        onStart={onStart}
        onPause={onPause}
        onResume={onResume}
        onStop={onStop}
        onOpenSettings={() => setIsSettingsOpen(true)}
        segmentStartTime={startTime}
        baseDuration={accumulatedDuration}
      />
      <AppLayout
        sidebar={
          <Sidebar
            recordings={recordings}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={onDelete}
            onRename={onRename}
          />
        }
      >
        <MainContent
          selected={selected}
          storageDir={storageDir}
          hasKey={hasKey}
          isSummarizing={isSummarizing}
          templateId={templateId}
          onTemplateChange={setTemplateId}
          onSummarize={onSummarize}
          onShowInFolder={onShowInFolder}
        />
      </AppLayout>

      <div className="bg-zinc-50 p-2 text-xs text-zinc-500 dark:bg-zinc-900 truncate h-[33px]" title={status}>
        {status}
      </div>

      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}

        storageDir={storageDir}
        storageDirDraft={storageDirDraft}
        onStorageDirDraftChange={setStorageDirDraft}
        onSaveStorage={onSaveStorage}

        micDevice={micDevice}
        devices={devices}
        onChangeMic={onChangeMic}

        recordingMode={recordingMode}
        onChangeRecordingMode={onChangeRecordingMode}

        apiKey={apiKey}
        hasKey={hasKey}
        onApiKeyChange={setApiKey}
        onSaveApiKey={onSaveApiKey}
        onClearApiKey={onClearApiKey}

        recordingQuality={recordingQuality}
        onChangeQuality={onChangeQuality}

        hotkey={hotkey}
        hotkeyDraft={hotkeyDraft}
        onHotkeyDraftChange={setHotkeyDraft}
        onSaveHotkey={onSaveHotkey}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Recording"
        description="Are you sure you want to delete this recording? This action cannot be undone."
        onConfirm={confirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
