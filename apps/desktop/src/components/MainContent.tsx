import type { RecordingMetadata } from "../types/recording";
import { AudioPlayer } from "./AudioPlayer";
import { MarkdownEditor } from "./MarkdownEditor";
import { Bot, FileText, Folder, Sparkles, Mic } from "lucide-react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { cn } from "../lib/utils";

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
      <div className="flex h-full flex-col items-center justify-center bg-zinc-50/50 text-center text-zinc-500 dark:bg-zinc-900/50 dark:text-zinc-400">
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
    <ScrollArea.Root className="h-full w-full bg-white dark:bg-zinc-950">
      <ScrollArea.Viewport className="h-full w-full">
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
                <button
                  onClick={onShowInFolder}
                  className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                  title="Show in Folder"
                >
                    <Folder className="w-5 h-5" />
                </button>
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

          <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

          {/* Transcript / Notes Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <span>AI Summary</span>
              </div>
              
              <div className="flex items-center gap-2">
                 <select
                    value={templateId}
                    onChange={(e) => onTemplateChange(e.target.value)}
                    className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:text-zinc-100 dark:focus:ring-zinc-100"
                  >
                    <option value="meeting_notes">Meeting Notes</option>
                    <option value="lecture_notes">Lecture Notes</option>
                    <option value="brainstorming">Brainstorming</option>
                    <option value="interview">Interview</option>
                  </select>
                  
                  <button
                    onClick={onSummarize}
                    disabled={isSummarizing || !hasKey}
                    className={cn(
                        "h-9 px-4 rounded-md text-sm font-medium transition-all flex items-center gap-2",
                        !hasKey 
                            ? "bg-zinc-100 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600" 
                            : "bg-purple-600 text-white hover:bg-purple-700 shadow-sm active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                    )}
                  >
                    {isSummarizing ? "Processing..." : "Generate"}
                    {!hasKey && <span className="sr-only">(Key missing)</span>}
                  </button>
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
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" className="flex select-none touch-none p-0.5 bg-zinc-100 transition-colors duration-[160ms] ease-out hover:bg-zinc-200 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2.5 dark:bg-zinc-800 dark:hover:bg-zinc-700">
        <ScrollArea.Thumb className="flex-1 bg-zinc-300 rounded-[10px] relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-[44px] before:min-h-[44px] dark:bg-zinc-600" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
