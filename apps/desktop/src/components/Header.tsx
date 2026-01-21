import { Settings, Mic, Square, Play, Pause } from "lucide-react";
import logo from "../assets/logo-motion.svg";
import { RecordingTimer } from "./RecordingTimer";

interface HeaderProps {
  recState: "idle" | "recording" | "paused";
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onOpenSettings: () => void;
  segmentStartTime: number | null;
  baseDuration: number;
}

export function Header({
  recState,
  onStart,
  onPause,
  onResume,
  onStop,
  onOpenSettings,
  segmentStartTime,
  baseDuration,
}: HeaderProps) {
  const isIdle = recState === "idle";
  const isRecording = recState === "recording";
  const isPaused = recState === "paused";

  return (
    <header className="relative flex h-14 items-center justify-between bg-white px-4 dark:bg-zinc-900 shrink-0 z-10">
      <div className="flex items-center gap-2 font-semibold text-[38px] tracking-tight">
        <div className="flex h-12 w-12 items-center justify-center">
          <img src={logo} alt="Summerizer" className="w-full h-full object-cover" />
        </div>
        <span>sum<span className="text-blue-800">me</span></span>
      </div>

      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50/50 p-1 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/50 shadow-sm">
        {isIdle ? (
          <button
            onClick={onStart}
            className="group flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-red-700 active:scale-95"
          >
            <Mic className="h-4 w-4" />
            <span>Record</span>
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 text-sm font-medium text-zinc-700 dark:text-zinc-200 min-w-[120px] justify-center">
              <div
                className={`h-2.5 w-2.5 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-amber-400"}`}
              />
              <RecordingTimer
                baseDuration={baseDuration}
                segmentStartTime={segmentStartTime}
                isRunning={isRecording}
              />
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

