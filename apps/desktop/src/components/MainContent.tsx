import type { RecordingMetadata } from "../types/recording";
import { AudioPlayer } from "./AudioPlayer";
import { MarkdownEditor } from "./MarkdownEditor";
import { Bot, FileText, Folder, Sparkles, Mic } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Select } from "./ui/select";
import { Separator } from "./ui/separator";

interface MainContentProps {
  selected: RecordingMetadata | null;
  storageDir: string;
  hasKey: boolean;
  isSummarizing: boolean;
  templateId: string;
  onTemplateChange: (id: string) => void;
  onSummarize: () => void;
  onShowInFolder: () => void;
}

function joinPaths(base: string, relative: string): string {
  const b = base.replace(/\/+$/, "");
  const r = relative.replace(/^\/+/, "");
  if (!b) return `/${r}`;
  return `${b}/${r}`;
}

export function MainContent({
  selected,
  storageDir,
  hasKey,
  isSummarizing,
  templateId,
  onTemplateChange,
  onSummarize,
  onShowInFolder,
}: MainContentProps) {
  if (!selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-zinc-50/50 text-center text-zinc-500 dark:bg-[#101013] dark:text-zinc-400">
        <div className="mb-4 rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
          <Bot className="h-8 w-8 opacity-50" />
        </div>
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No recording selected</h3>
        <p className="mt-1 max-w-sm text-sm">Select a recording from the sidebar or start a new recording to get started.</p>
      </div>
    );
  }

  const selectedAbsAudioPath = joinPaths(storageDir, selected.audio.relative_path);
  const selectedAbsSystemAudioPath = selected.system_audio
    ? joinPaths(storageDir, selected.system_audio.relative_path)
    : null;
  const selectedAbsMergedAudioPath = selected.merged_audio
    ? joinPaths(storageDir, selected.merged_audio.relative_path)
    : null;

  return (
    <ScrollArea className="h-full w-full bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl p-6 space-y-6">
          
          {/* Audio Section */}
          <section className="space-y-4">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 break-all">
                    {selected.title || selected.id}
                    </h1>
                    <div className="mt-1 text-sm text-zinc-500 flex items-center gap-2">
                        <span>{new Date(selected.created_at).toLocaleString()}</span>
                        <span>•</span>
                        <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                            {Math.round((selected.audio.duration_ms || 0) / 1000)}s
                        </span>
                    </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onShowInFolder}
                  title="Show in Folder"
                >
                    <Folder className="w-5 h-5" />
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    <Mic className="w-3 h-3" /> Microphone
                </div>
                <AudioPlayer absolutePath={selectedAbsAudioPath} />
              </div>
              
              {selectedAbsSystemAudioPath && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    <Bot className="w-3 h-3" /> System Audio
                  </div>
                  <AudioPlayer absolutePath={selectedAbsSystemAudioPath} />
                </div>
              )}

              {selectedAbsMergedAudioPath && (
                 <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                   <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                     <FileText className="w-3 h-3" /> Merged Audio
                   </div>
                   <AudioPlayer absolutePath={selectedAbsMergedAudioPath} />
                 </div>
              )}
            </div>
          </section>

          <Separator />

          {/* Transcript / Notes Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                <Sparkles className="w-5 h-5 text-white-800" />
                <span>AI Summary</span>
              </div>
              
              <div className="flex items-center gap-2">
                 <Select
                    value={templateId}
                    onChange={(e) => onTemplateChange(e.target.value)}
                    className="w-[150px]"
                  >
                    <option value="meeting_notes">Meeting Notes</option>
                    <option value="lecture_notes">Lecture Notes</option>
                    <option value="brainstorming">Brainstorming</option>
                    <option value="interview">Interview</option>
                  </Select>
                  
                  <Button
                    onClick={onSummarize}
                    disabled={isSummarizing || !hasKey}
                    className="bg-purple-600 text-white hover:bg-purple-700"
                  >
                    {isSummarizing ? "Processing..." : "Generate"}
                    {!hasKey && <span className="sr-only">(Key missing)</span>}
                  </Button>
              </div>
            </div>

            <div className="min-h-[400px] rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
               <MarkdownEditor
                  recordingId={selected.id}
                  initialPath={selected.markdown_relative_path || ""}
               />
            </div>
          </section>
        </div>
    </ScrollArea>
  );
}
