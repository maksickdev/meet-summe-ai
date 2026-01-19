import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Settings, FolderOpen, Mic, Key } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure storage, audio devices, and AI keys.
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
            <div className="flex items-center space-x-2">
              <Switch
                id="merge-mode"
                checked={mergeEnabled}
                onCheckedChange={onToggleMerge}
              />
              <Label htmlFor="merge-mode">Merge system audio & mic (Beta)</Label>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
