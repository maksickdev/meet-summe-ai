import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { readRecordingNote, saveRecordingNote } from "../ipc";

export type MarkdownEditorProps = {
  recordingId: string;
  initialPath: string; // just to trigger reload if changed
};

export function MarkdownEditor({ recordingId }: MarkdownEditorProps) {
  const [content, setContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    loadNote();
  }, [recordingId]);

  async function loadNote() {
    setStatus("Loading...");
    try {
      const text = await readRecordingNote(recordingId);
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
      await saveRecordingNote(recordingId, draft);
      setContent(draft);
      setIsEditing(false);
      setStatus("Saved.");
    } catch (e) {
      setStatus(`Error saving: ${String(e)}`);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-zinc-500">
          Notes {status && <span className="font-normal text-zinc-400">({status})</span>}
        </div>
        <div className="flex gap-2">
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
                  onSave().catch(() => {});
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

      {isEditing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-[300px] w-full rounded-md border border-zinc-300 bg-white p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      ) : content ? (
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {content}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No notes yet. Click "Summarize" to generate one.
        </div>
      )}
    </div>
  );
}
