import { useMemo } from "react";

export type RecordingControlsProps = {
  state: "idle" | "recording" | "paused";
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

export function RecordingControls({ state, onStart, onPause, onResume, onStop }: RecordingControlsProps) {
  const canStart = state === "idle";
  const canPause = state === "recording";
  const canResume = state === "paused";
  const canStop = state !== "idle";

  const statusText = useMemo(() => {
    if (state === "idle") return "Idle";
    if (state === "paused") return "Paused";
    return "Recording";
  }, [state]);

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">Recording</div>
        <div className="text-xs text-zinc-600 dark:text-zinc-400">Status: {statusText}</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Start
        </button>
        <button
          type="button"
          onClick={onPause}
          disabled={!canPause}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={onResume}
          disabled={!canResume}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Resume
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!canStop}
          className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-50"
        >
          Stop
        </button>
      </div>

      <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        System audio is captured natively. On macOS, ensure Screen Recording permission is granted.
      </div>
    </section>
  );
}
