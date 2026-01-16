import { Settings, Mic, Square, Play, Pause } from "lucide-react";

interface HeaderProps {
  recState: "idle" | "recording" | "paused";
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onOpenSettings: () => void;
}

export function Header({
  recState,
  onStart,
  onPause,
  onResume,
  onStop,
  onOpenSettings,
}: HeaderProps) {
  const isIdle = recState === "idle";
  const isRecording = recState === "recording";
  const isPaused = recState === "paused";

  return (
    <header className="relative flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 shrink-0 z-10">
      <div className="flex items-center gap-2 font-semibold text-lg tracking-tight">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900">
          <span className="font-bold">S</span>
        </div>
        <span>Summerizer</span>
      </div>

      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50/50 p-1 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/50 shadow-sm">
        {isIdle ? (
          <button
            onClick={onStart}
            className="group flex items-center gap-2 rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-red-700 active:scale-95"
          >
            <Mic className="h-4 w-4" />
            <span>Record</span>
          </button>
        ) : (
          <>
            <div className="px-3 text-xs font-mono text-zinc-500 animate-pulse">
              {isRecording ? "REC ●" : "PAUSED"}
            </div>
            
            {isRecording && (
               <button
                 onClick={onPause}
                 className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                 title="Pause"
               >
                 <Pause className="h-4 w-4 fill-current" />
               </button>
            )}

            {isPaused && (
               <button
                 onClick={onResume}
                 className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                 title="Resume"
               >
                 <Play className="h-4 w-4 fill-current" />
               </button>
            )}

            <button
              onClick={onStop}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              title="Stop"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          </>
        )}
      </div>

      <button
        onClick={onOpenSettings}
        className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        title="Settings"
      >
        <Settings className="h-5 w-5" />
      </button>
    </header>
  );
}
