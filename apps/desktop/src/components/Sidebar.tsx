import { useState, useRef, useEffect } from "react";
import type { RecordingMetadata } from "../types/recording";
import { cn } from "../lib/utils";
import { Music, Calendar, Trash2, Edit2 } from "lucide-react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import * as ContextMenu from "@radix-ui/react-context-menu";

interface SidebarProps {
  recordings: RecordingMetadata[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  className?: string;
}

export function Sidebar({ recordings, selectedId, onSelect, onDelete, onRename, className }: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function startRenaming(rec: RecordingMetadata) {
    setEditingId(rec.id);
    setEditValue(rec.title || `Recording ${rec.id.slice(0, 8)}...`);
  }

  function saveRename() {
    if (editingId && editValue.trim()) {
        onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
        saveRename();
    } else if (e.key === "Escape") {
        setEditingId(null);
    }
  }

  return (
    <div className={cn("flex h-full w-64 flex-col border-r border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50", className)}>
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-950">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Music className="w-4 h-4" />
          Library
        </h2>
        <p className="text-xs text-zinc-500 mt-1">{recordings.length} recordings</p>
      </div>
      
      <ScrollArea.Root className="flex-1 overflow-hidden bg-white dark:bg-zinc-950">
        <ScrollArea.Viewport className="h-full w-full p-2 space-y-1">
          {recordings.length === 0 ? (
            <div className="p-4 text-center text-sm text-zinc-500">
              No recordings yet.
            </div>
          ) : (
            recordings.map((rec) => (
              <ContextMenu.Root key={rec.id}>
                <ContextMenu.Trigger>
                  <div
                    onClick={() => {
                        if (editingId !== rec.id) onSelect(rec.id);
                    }}
                    className={cn(
                      "group w-full text-left p-3 rounded-lg text-sm transition-colors cursor-pointer select-none",
                      "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                      selectedId === rec.id
                        ? "bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-700 shadow-sm"
                        : "text-zinc-600 dark:text-zinc-400"
                    )}
                  >
                    {editingId === rec.id ? (
                        <input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveRename}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-transparent outline-none font-medium text-zinc-900 dark:text-zinc-100 border-b border-blue-500 pb-0.5"
                        />
                    ) : (
                        <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {rec.title || `Recording ${rec.id.slice(0, 8)}...`}
                        </div>
                    )}
                    
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-zinc-500">
                      <Calendar className="w-3 h-3" />
                      {rec.created_at.split('T')[0]}
                      {rec.audio.duration_ms ? (
                        <span className="ml-auto font-mono">
                          {Math.round(rec.audio.duration_ms / 1000)}s
                        </span>
                      ) : null}
                    </div>
                  </div>
                </ContextMenu.Trigger>
                
                <ContextMenu.Portal>
                  <ContextMenu.Content className="min-w-[160px] overflow-hidden rounded-md border border-zinc-200 bg-white p-1 shadow-md dark:border-zinc-800 dark:bg-zinc-950 z-50">
                    <ContextMenu.Item 
                        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-zinc-100 focus:text-zinc-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:focus:bg-zinc-800 dark:focus:text-zinc-50"
                        onSelect={() => startRenaming(rec)}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      Rename
                    </ContextMenu.Item>
                    <ContextMenu.Item 
                        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-red-50 focus:text-red-600 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:focus:bg-red-950/20 dark:focus:text-red-400 text-red-600 dark:text-red-400"
                        onSelect={() => {
                          setTimeout(() => onDelete(rec.id), 0);
                        }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </ContextMenu.Item>
                  </ContextMenu.Content>
                </ContextMenu.Portal>
              </ContextMenu.Root>
            ))
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className="flex select-none touch-none p-0.5 bg-zinc-100 transition-colors duration-[160ms] ease-out hover:bg-zinc-200 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2.5 dark:bg-zinc-800 dark:hover:bg-zinc-700">
          <ScrollArea.Thumb className="flex-1 bg-zinc-300 rounded-[10px] relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-[44px] before:min-h-[44px] dark:bg-zinc-600" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
