import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "./ui/button";

export type AudioPlayerProps = {
  absolutePath: string;
};

const BAR_WIDTH = 3;
const BAR_GAP = 2;
const MIN_BAR_COUNT = 12;
const WAVEFORM_ANALYSIS_BARS = 512;

export function AudioPlayer({ absolutePath }: AudioPlayerProps) {
  const src = convertFileSrc(absolutePath);
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [waveformWidth, setWaveformWidth] = useState(0);
  const [sourcePeaks, setSourcePeaks] = useState<number[]>(
    Array.from({ length: WAVEFORM_ANALYSIS_BARS }, () => 0.35),
  );
  const [displayPeaks, setDisplayPeaks] = useState<number[]>(Array.from({ length: 48 }, () => 0.35));

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [src]);

  useEffect(() => {
    let isCancelled = false;

    async function buildWaveform() {
      try {
        const response = await fetch(src);
        const audioData = await response.arrayBuffer();
        const AudioContextClass = window.AudioContext || (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;
        if (!AudioContextClass) return;

        const context = new AudioContextClass();
        const decoded = await context.decodeAudioData(audioData.slice(0));
        const channelData = decoded.getChannelData(0);
        const barCount = WAVEFORM_ANALYSIS_BARS;
        const blockSize = Math.max(1, Math.floor(channelData.length / barCount));
        const nextPeaks: number[] = [];

        for (let i = 0; i < barCount; i++) {
          const start = i * blockSize;
          const end = Math.min(start + blockSize, channelData.length);
          let peak = 0;

          for (let j = start; j < end; j++) {
            const value = Math.abs(channelData[j]);
            if (value > peak) peak = value;
          }

          nextPeaks.push(peak);
        }

        const maxPeak = Math.max(...nextPeaks, 0.01);
        const normalized = nextPeaks.map((p) => Math.max(0.08, p / maxPeak));
        if (!isCancelled) setSourcePeaks(normalized);
        void context.close();
      } catch {
        if (!isCancelled) {
          setSourcePeaks(
            Array.from({ length: WAVEFORM_ANALYSIS_BARS }, (_, i) => 0.15 + ((i % 7) / 7) * 0.5),
          );
        }
      }
    }

    void buildWaveform();
    return () => {
      isCancelled = true;
    };
  }, [src]);

  useEffect(() => {
    if (!waveformRef.current) return;

    const element = waveformRef.current;
    const resizeObserver = new ResizeObserver(() => {
      setWaveformWidth(element.clientWidth);
    });

    setWaveformWidth(element.clientWidth);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const segmentWidth = BAR_WIDTH + BAR_GAP;
    const horizontalPadding = 8; // px-1 on both sides
    const innerWidth = Math.max(0, waveformWidth - horizontalPadding);
    const targetCount = Math.max(
      MIN_BAR_COUNT,
      Math.floor((innerWidth + BAR_GAP) / segmentWidth),
    );

    if (!sourcePeaks.length) {
      setDisplayPeaks(Array.from({ length: targetCount }, () => 0.35));
      return;
    }

    const blockSize = sourcePeaks.length / targetCount;
    const next: number[] = [];

    for (let i = 0; i < targetCount; i++) {
      const start = Math.floor(i * blockSize);
      const end = Math.min(sourcePeaks.length, Math.floor((i + 1) * blockSize));
      let peak = 0.08;
      for (let j = start; j < end; j++) {
        if (sourcePeaks[j] > peak) peak = sourcePeaks[j];
      }
      next.push(peak);
    }

    setDisplayPeaks(next);
  }, [sourcePeaks, waveformWidth]);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      await audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const seekByClientX = (clientX: number) => {
    if (!waveformRef.current || !audioRef.current || duration <= 0) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, ratio));
    const time = clamped * duration;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const onWaveMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isScrubbingRef.current = true;
    seekByClientX(e.clientX);
  };

  const onWaveTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    isScrubbingRef.current = true;
    seekByClientX(e.touches[0].clientX);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isScrubbingRef.current) return;
      seekByClientX(e.clientX);
    };
    const onMouseUp = () => {
      isScrubbingRef.current = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isScrubbingRef.current) return;
      seekByClientX(e.touches[0].clientX);
    };
    const onTouchEnd = () => {
      isScrubbingRef.current = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [duration]);

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="hidden"
      />
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={togglePlay}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      <div className="flex-1 min-w-0 space-y-1">
        <div
          ref={waveformRef}
          className="h-9 w-full cursor-pointer overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 px-1 py-1 dark:border-zinc-800 dark:bg-zinc-900"
          onMouseDown={onWaveMouseDown}
          onTouchStart={onWaveTouchStart}
        >
          <div className="flex h-full items-end gap-[2px]">
            {displayPeaks.map((peak, idx) => {
              const progress = duration > 0 ? currentTime / duration : 0;
              const ratio = displayPeaks.length > 1 ? idx / (displayPeaks.length - 1) : 0;
              const isPlayed = ratio <= progress;
              return (
                <div
                  key={idx}
                  className={`shrink-0 rounded-sm transition-colors ${isPlayed ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-300 dark:bg-zinc-700"}`}
                  style={{ width: `${BAR_WIDTH}px`, height: `${18 + peak * 82}%` }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-zinc-500"
        onClick={toggleMute}
      >
        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}
