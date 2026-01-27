import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { RotateCcw } from "lucide-react";
import { readRecordingNote, saveRecordingNote } from "../ipc";

export type MarkdownEditorProps = {
  recordingId: string;
  noteId?: string; // If provided, load this specific note
  initialPath?: string; // used for backward compatibility or to trigger reload
  onRegenerate?: () => void;
  isRegenerating?: boolean;
};

export function MarkdownEditor({ recordingId, noteId, onRegenerate, isRegenerating }: MarkdownEditorProps) {
  const [content, setContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    loadNote();
  }, [recordingId, noteId]);

  async function loadNote() {
    setStatus("Loading...");
    try {
      const text = await readRecordingNote(recordingId, noteId);
      setContent(text);
      setDraft(text);
      setStatus("");
    } catch (e) {
      setStatus(`Error loading note: ${String(e)}`);
    }
  }

  async function onSave() {
    setStatus("Saving...");
    try {
      await saveRecordingNote(recordingId, draft, noteId);
      setContent(draft);
      setIsEditing(false);
      setStatus("Saved.");
    } catch (e) {
      setStatus(`Error saving: ${String(e)}`);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="text-xs font-semibold uppercase text-zinc-500">
          Notes {status && <span className="font-normal text-zinc-400">({status})</span>}
        </div>
        <div className="flex gap-2">
          {onRegenerate && !isEditing && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-50 p-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isRegenerating ? "Processing..." : "Regenerate"}
            </button>
          )}
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onSave().catch(() => { });
                }}
                className="rounded bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Save
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setDraft(content);
                setIsEditing(true);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col min-h-0 p-4">
        {isEditing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full flex-1 resize-none bg-transparent font-mono text-sm outline-none dark:text-zinc-50"
          />
        ) : content ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No notes yet. Click "Generate" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
