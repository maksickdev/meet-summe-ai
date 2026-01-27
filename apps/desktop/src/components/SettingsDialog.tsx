import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Settings, FolderOpen, Mic, Key, Keyboard, Sparkles, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Separator } from "./ui/separator";
import { HotkeyRecorder } from "./HotkeyRecorder";
import { CustomPrompt } from "../types/recording";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storageDir: string;
  storageDirDraft: string;
  onStorageDirDraftChange: (val: string) => void;
  onSaveStorage: () => void;

  micDevice: string;
  devices: string[];
  onChangeMic: (val: string) => void;

  recordingMode: string;
  onChangeRecordingMode: (val: string) => void;

  apiKey: string;
  hasKey: boolean;
  onApiKeyChange: (val: string) => void;
  onSaveApiKey: () => void;
  onClearApiKey: () => void;

  recordingQuality: string;
  onChangeQuality: (val: string) => void;

  hotkey: string;
  hotkeyDraft: string;
  onHotkeyDraftChange: (val: string) => void;
  onSaveHotkey: () => void;

  customPrompts: CustomPrompt[];
  onCreatePrompt: (name: string, content: string) => void;
  onUpdatePrompt: (id: string, name: string, content: string) => void;
  onDeletePrompt: (id: string) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  storageDir,
  storageDirDraft,
  onStorageDirDraftChange,
  onSaveStorage,
  micDevice,
  devices,
  onChangeMic,
  recordingMode,
  onChangeRecordingMode,
  apiKey,
  hasKey,
  onApiKeyChange,
  onSaveApiKey,
  onClearApiKey,
  recordingQuality,
  onChangeQuality,
  hotkey,
  hotkeyDraft,
  onHotkeyDraftChange,
  onSaveHotkey,
  customPrompts,
  onCreatePrompt,
  onUpdatePrompt,
  onDeletePrompt,
}: SettingsDialogProps) {
  const [isAddingPrompt, setIsAddingPrompt] = useState(false);
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");

  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");

  const handleCreate = () => {
    if (newPromptName && newPromptContent) {
      onCreatePrompt(newPromptName, newPromptContent);
      setNewPromptName("");
      setNewPromptContent("");
      setIsAddingPrompt(false);
    }
  };

  const startEdit = (p: CustomPrompt) => {
    setEditingPromptId(p.id);
    setEditName(p.name);
    setEditContent(p.content);
  };

  const handleUpdate = () => {
    if (editingPromptId && editName && editContent) {
      onUpdatePrompt(editingPromptId, editName, editContent);
      setEditingPromptId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure storage, audio devices, and AI prompts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Storage Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <FolderOpen className="w-4 h-4" />
              Storage Directory
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono bg-zinc-100 dark:bg-zinc-800 p-2 rounded break-all">
              {storageDir || "Default app directory"}
            </div>
            <div className="flex gap-2">
              <Input
                value={storageDirDraft}
                onChange={(e) => onStorageDirDraftChange(e.target.value)}
                placeholder="/absolute/path/to/storage"
                className="flex-1"
              />
              <Button onClick={onSaveStorage}>Save</Button>
            </div>
          </div>

          <Separator />

          {/* AI Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                Gemini API Key
              </div>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  hasKey
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                )}
              >
                {hasKey ? "Active" : "Missing"}
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder="Paste Gemini API Key"
                className="flex-1"
              />
              <Button onClick={onSaveApiKey}>Save</Button>
            </div>
            {hasKey && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearApiKey}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 h-auto p-0 px-2"
              >
                Remove API Key
              </Button>
            )}
          </div>

          <Separator />

          {/* Prompts Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Custom Prompts
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setIsAddingPrompt(true)}
              >
                <Plus className="w-3.5 h-3.5" /> New
              </Button>
            </div>

            <div className="space-y-2">
              {customPrompts.map(p => (
                <div key={p.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 space-y-2">
                  {editingPromptId === p.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Prompt Name"
                      />
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="w-full min-h-[80px] text-xs p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-transparent"
                        placeholder="Prompt content..."
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingPromptId(null)}><X className="w-4 h-4" /></Button>
                        <Button size="sm" onClick={handleUpdate}><Check className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{p.name}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(p)}><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => onDeletePrompt(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-2">{p.content}</p>
                    </>
                  )}
                </div>
              ))}

              {isAddingPrompt && (
                <div className="rounded-lg border-2 border-dashed border-purple-200 p-3 dark:border-purple-900/30 space-y-2">
                  <Input
                    autoFocus
                    value={newPromptName}
                    onChange={e => setNewPromptName(e.target.value)}
                    placeholder="New Prompt Name"
                  />
                  <textarea
                    value={newPromptContent}
                    onChange={e => setNewPromptContent(e.target.value)}
                    className="w-full min-h-[80px] text-xs p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-transparent"
                    placeholder="Prompt content (e.g. Please summarize this meeting into actionable tasks...)"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setIsAddingPrompt(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleCreate}>Create</Button>
                  </div>
                </div>
              )}

              {customPrompts.length === 0 && !isAddingPrompt && (
                <div className="text-center py-4 text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                  No custom prompts yet. Create one to use specialized summarization.
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Audio Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <Mic className="w-4 h-4" />
              Audio Input
            </div>
            <Select
              value={micDevice}
              onChange={(e) => onChangeMic(e.target.value)}
            >
              <option value="">System Audio Only</option>
              {devices.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            <div className="space-y-3 pt-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Recording Mode
              </div>
              <Select
                value={recordingMode}
                onChange={(e) => onChangeRecordingMode(e.target.value)}
              >
                <option value="merged">Merged (single file)</option>
                <option value="separated">Separated (three files: mic, system, merged)</option>
              </Select>
            </div>

            <div className="space-y-3 pt-2">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Recording Quality
              </div>
              <Select
                value={recordingQuality}
                onChange={(e) => onChangeQuality(e.target.value)}
              >
                <option value="quality">Quality Priority (48kHz, Stereo, 64kbps)</option>
                <option value="size">Size Priority (16kHz, Mono, 32kbps)</option>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Shortcut Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <Keyboard className="w-4 h-4" />
              Global Shortcut
            </div>
            <div className="flex gap-2">
              <HotkeyRecorder
                value={hotkeyDraft}
                onChange={onHotkeyDraftChange}
                className="flex-1"
              />
              <Button onClick={onSaveHotkey}>Save</Button>
            </div>
            <p className="text-xs text-zinc-500">
              Current: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{hotkey}</code>.
              Supports <code>CommandOrControl</code>, <code>Shift</code>, <code>Alt</code>, <code>Option</code>.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
