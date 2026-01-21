import { useEffect, useState } from "react";

interface RecordingTimerProps {
  baseDuration: number;
  segmentStartTime: number | null;
  isRunning: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function RecordingTimer({
  baseDuration,
  segmentStartTime,
  isRunning,
}: RecordingTimerProps) {
  const [displayTime, setDisplayTime] = useState(baseDuration);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isRunning && segmentStartTime) {
      // Update immediately to avoid delay
      setDisplayTime(baseDuration + (Date.now() - segmentStartTime));

      interval = setInterval(() => {
        setDisplayTime(baseDuration + (Date.now() - segmentStartTime));
      }, 1000); // Update every second is enough for HH:MM:SS
    } else {
      setDisplayTime(baseDuration);
    }

    return () => clearInterval(interval);
  }, [baseDuration, segmentStartTime, isRunning]);

  return <span className="font-mono tabular-nums">{formatTime(displayTime)}</span>;
}
