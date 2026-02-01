import { useState, useEffect } from "react";
import type { RecordingMetadata, CustomPrompt } from "../types/recording";
import { AudioPlayer } from "./AudioPlayer";
import { MarkdownEditor } from "./MarkdownEditor";
import { Bot, FileText, Folder, Sparkles, Mic, Plus } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Select } from "./ui/select";
import { Separator } from "./ui/separator";

interface MainContentProps {
  selected: RecordingMetadata | null;
  storageDir: string;
  hasKey: boolean;
  isSummarizing: boolean;
  customPrompts: CustomPrompt[];
  onSummarize: (promptId: string, noteId?: string) => void;
  onDeleteNote: (noteId: string) => void;
  onShowInFolder: () => void;
}

function joinPaths(base: string, relative: string): string {
  const b = base.replace(/\/+$/, "");
  const r = relative.replace(/^\/+/, "");
  if (!b) return `/${r}`;
  return `${b}/${r}`;
}

const DEFAULT_PROMPTS = [
  { id: "meeting_notes", name: "Meeting Notes" },
  { id: "lecture_notes", name: "Lecture Notes" },
  { id: "brainstorming", name: "Brainstorming" },
  { id: "interview", name: "Interview" },
];

export function MainContent({
  selected,
  storageDir,
  hasKey,
  isSummarizing,
  customPrompts,
  onSummarize,
  onDeleteNote,
  onShowInFolder,
}: MainContentProps) {
  const [activeNoteId, setActiveNoteId] = useState<string | undefined>();
  const [selectedPromptId, setSelectedPromptId] = useState<string>("meeting_notes");

  // Keep track of notes count to auto-select new notes
  const notesCount = selected?.notes?.length ?? 0;

  useEffect(() => {
    if (selected?.notes && selected.notes.length > 0) {
      if (!activeNoteId || !selected.notes.find(n => n.id === activeNoteId)) {
        setActiveNoteId(selected.notes[0].id);
      }
    } else {
      setActiveNoteId(undefined);
    }
  }, [selected?.id, notesCount]);

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

  const totalDurationMs = selected.audio_parts.reduce((acc, part) => acc + (part.mic.duration_ms || 0), 0);
  const currentNote = selected.notes?.find(n => n.id === activeNoteId);

  return (
    <ScrollArea className="h-full w-full bg-white dark:bg-[#101013]">
      <div className="mx-auto max-w-8xl p-6 space-y-6">

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
                  {Math.round(totalDurationMs / 1000)}s
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

          <div className="space-y-6">
            {[...selected.audio_parts]
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map((part, index) => {
                const absMicPath = joinPaths(storageDir, part.mic.relative_path);
                const absSystemPath = part.system ? joinPaths(storageDir, part.system.relative_path) : null;
                const absMergedPath = part.merged ? joinPaths(storageDir, part.merged.relative_path) : null;

                return (
                  <div key={part.id || index} className="space-y-3">
                    {selected.audio_parts.length > 1 && (
                      <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-2">
                        <Plus className="w-3 h-3" /> Part {index + 1} — {new Date(part.created_at).toLocaleTimeString()}
                      </div>
                    )}
                    <div className={`grid gap-4 ${(!part.system && !part.merged) ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
                      <div className={`rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 ${(!part.system && !part.merged) ? 'col-span-full' : ''}`}>
                        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                          <Mic className="w-3 h-3" />
                          {(!part.system && !part.merged) ? "Recording" : "Microphone"}
                        </div>
                        <AudioPlayer absolutePath={absMicPath} />
                      </div>

                      {absSystemPath && part.system && (
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                            <Bot className="w-3 h-3" /> System Audio
                          </div>
                          <AudioPlayer absolutePath={absSystemPath} />
                        </div>
                      )}

                      {absMergedPath && part.merged && (
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                            <FileText className="w-3 h-3" /> Merged Audio
                          </div>
                          <AudioPlayer absolutePath={absMergedPath} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        <Separator />

        {/* AI Notes Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              <Sparkles className="w-5 h-5 " />
              <span>AI Notes</span>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={selectedPromptId}
                onChange={(e) => setSelectedPromptId(e.target.value)}
                className="w-[180px]"
              >
                <optgroup label="Default">
                  {DEFAULT_PROMPTS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
                {customPrompts.length > 0 && (
                  <optgroup label="Custom">
                    {customPrompts.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                )}
              </Select>

              <Button
                onClick={() => onSummarize(selectedPromptId)}
                disabled={isSummarizing || !hasKey}
                className="bg-purple-600 text-white hover:bg-purple-700 gap-2"
              >
                {isSummarizing ? "Processing..." : <><Plus className="w-4 h-4" /> Generate New</>}
              </Button>
            </div>
          </div>

          {/* Tabs for notes */}
          {selected.notes && selected.notes.length > 0 && (
            <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto pb-px">
              {selected.notes.map((note) => {
                const prompt = [...DEFAULT_PROMPTS, ...customPrompts].find(p => p.id === note.prompt_id);
                const isActive = note.id === activeNoteId;
                return (
                  <button
                    key={note.id}
                    onClick={() => setActiveNoteId(note.id)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${isActive
                      ? "border-zinc-200 text-zinc-600 dark:text-zinc-200"
                      : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                      }`}
                  >
                    {prompt?.name || "Note"}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex min-h-[500px] flex-col rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 relative">
            <MarkdownEditor
              recordingId={selected.id}
              noteId={activeNoteId}
              onRegenerate={currentNote ? () => onSummarize(currentNote.prompt_id, currentNote.id) : undefined}
              onDeleteNote={activeNoteId ? () => onDeleteNote(activeNoteId) : undefined}
              isRegenerating={isSummarizing}
            />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
