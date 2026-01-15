import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";

export type AudioPlayerProps = {
  absolutePath: string;
};

export function AudioPlayer({ absolutePath }: AudioPlayerProps) {
  const src = convertFileSrc(absolutePath);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [src]);

  return (
    <div className="space-y-2">
      <div className="text-xs text-zinc-600 dark:text-zinc-400">Player</div>
      <audio ref={audioRef} controls className="w-full" key={absolutePath}>
        <source src={src} />
      </audio>
    </div>
  );
}
