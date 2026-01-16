import * as Dialog from "@radix-ui/react-dialog";
import { X, Settings, FolderOpen, Mic, Key } from "lucide-react";
import { cn } from "../lib/utils";

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
  
  mergeEnabled: boolean;
  onToggleMerge: (val: boolean) => void;
  
  apiKey: string;
  hasKey: boolean;
  onApiKeyChange: (val: string) => void;
  onSaveApiKey: () => void;
  onClearApiKey: () => void;
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
  mergeEnabled,
  onToggleMerge,
  apiKey,
  hasKey,
  onApiKeyChange,
  onSaveApiKey,
  onClearApiKey,
}: SettingsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none z-50 overflow-y-auto">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-6">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Settings
            </Dialog.Title>
            <Dialog.Description className="text-sm text-zinc-500 dark:text-zinc-400">
              Configure storage, audio devices, and AI keys.
            </Dialog.Description>
          </div>

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
                <input
                  value={storageDirDraft}
                  onChange={(e) => onStorageDirDraftChange(e.target.value)}
                  placeholder="/absolute/path/to/storage"
                  className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700"
                />
                <button
                  onClick={onSaveStorage}
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

            {/* Audio Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <Mic className="w-4 h-4" />
                Audio Input
              </div>
              <select
                value={micDevice}
                onChange={(e) => onChangeMic(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:text-zinc-100"
              >
                <option value="">System Audio Only</option>
                {devices.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mergeEnabled}
                  onChange={(e) => onToggleMerge(e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                Merge system audio & mic (Beta)
              </label>
            </div>

            <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

            {/* AI Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm font-medium text-zinc-900 dark:text-zinc-100">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Gemini API Key
                </div>
                <span className={cn("text-xs px-2 py-0.5 rounded-full", hasKey ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                  {hasKey ? "Active" : "Missing"}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  placeholder="Paste Gemini API Key"
                  className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700"
                />
                <button
                  onClick={onSaveApiKey}
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Save
                </button>
              </div>
              {hasKey && (
                <button
                  onClick={onClearApiKey}
                  className="text-xs text-red-500 hover:text-red-600 hover:underline"
                >
                  Remove API Key
                </button>
              )}
            </div>
          </div>

          <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-zinc-100 data-[state=open]:text-zinc-500 dark:ring-offset-zinc-950 dark:focus:ring-zinc-300 dark:data-[state=open]:bg-zinc-800 dark:data-[state=open]:text-zinc-400">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
