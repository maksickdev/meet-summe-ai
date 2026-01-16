import type { RecordingMetadata } from "../types/recording";
import { cn } from "../lib/utils";
import { Music, Calendar } from "lucide-react";
import * as ScrollArea from "@radix-ui/react-scroll-area";

interface SidebarProps {
  recordings: RecordingMetadata[];
  selectedId: string;
  onSelect: (id: string) => void;
  status?: string;
  className?: string;
}

export function Sidebar({ recordings, selectedId, onSelect, status, className }: SidebarProps) {
  return (
    <div className={cn("flex h-full w-64 flex-col border-r border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50", className)}>
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
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
              <button
                key={rec.id}
                onClick={() => onSelect(rec.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg text-sm transition-colors",
                  "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                  selectedId === rec.id
                    ? "bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-700 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400"
                )}
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {rec.title || `Recording ${rec.id.slice(0, 8)}...`}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-zinc-500">
                  <Calendar className="w-3 h-3" />
                  {rec.created_at.split('T')[0]}
                  {rec.audio.duration_ms ? (
                    <span className="ml-auto font-mono">
                      {Math.round(rec.audio.duration_ms / 1000)}s
                    </span>
                  ) : null}
                </div>
              </button>
            ))
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className="flex select-none touch-none p-0.5 bg-zinc-100 transition-colors duration-[160ms] ease-out hover:bg-zinc-200 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2.5 dark:bg-zinc-800 dark:hover:bg-zinc-700">
          <ScrollArea.Thumb className="flex-1 bg-zinc-300 rounded-[10px] relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-[44px] before:min-h-[44px] dark:bg-zinc-600" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      {status && (
        <div className="border-t border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 truncate" title={status}>
          {status}
        </div>
      )}
    </div>
  );
}
