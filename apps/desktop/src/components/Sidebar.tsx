import { useState, useRef, useEffect } from "react";
import type { RecordingMetadata } from "../types/recording";
import { cn } from "../lib/utils";
import { Music, Calendar, Trash2, Edit2 } from "lucide-react";
import { ScrollArea } from "./ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./ui/context-menu";
import { Input } from "./ui/input";

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
    <div className={cn("flex h-full w-64 flex-col border border-zinc-200 bg-[#101013] rounded-lg dark:border-zinc-800", className)}>
      <div className="p-4">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Music className="w-4 h-4" />
          Library
        </h2>
        <p className="text-xs text-zinc-500 mt-1">{recordings.length} recordings</p>
      </div>
      
      <ScrollArea className="flex-1 bg-transparent">
          {recordings.length === 0 ? (
            <div className="p-4 text-center text-sm text-zinc-500">
              No recordings yet.
            </div>
          ) : (
            <div className="p-2 space-y-1">
            {recordings.map((rec) => (
              <ContextMenu key={rec.id}>
                <ContextMenuTrigger>
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
                        <Input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveRename}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 w-full px-1 py-0 text-sm bg-transparent border-blue-500"
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
                </ContextMenuTrigger>
                
                <ContextMenuContent>
                    <ContextMenuItem 
                        onSelect={() => startRenaming(rec)}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      Rename
                    </ContextMenuItem>
                    <ContextMenuItem 
                        className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20 dark:text-red-400 dark:focus:text-red-400"
                        onSelect={() => {
                          setTimeout(() => onDelete(rec.id), 0);
                        }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
            </div>
          )}
      </ScrollArea>
    </div>
  );
}
