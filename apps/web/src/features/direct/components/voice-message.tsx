'use client';

import { Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../api';
import { formatVoiceTime } from '../voice/use-voice-recorder';

// Only one voice message plays at a time: starting another pauses this one
let playing: HTMLAudioElement | null = null;

/** Cloudinary keeps the recording as it came (WebM, MP4); MP3 plays in every browser */
const playableUrl = (url: string) =>
  url.startsWith('https://res.cloudinary.com/') ? url.replace(/\.[a-z0-9]+$/i, '.mp3') : url;

// A voice message: play / pause, the waveform filling up as it plays (a click on it jumps
// there), and the time: the length when stopped, the position while playing.
export function VoiceMessage({
  message,
  mine,
  className,
}: {
  message: ChatMessage;
  mine: boolean;
  className: string;
}) {
  const t = useTranslations('direct.voice');
  const audio = useRef<HTMLAudioElement>(null);
  const frame = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const voice = message.voice;
  const duration = voice?.duration ?? 0;
  const bars = voice?.waveform.length ? voice.waveform : [0];
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  // Smooth progress while playing (timeupdate fires only ~4 times a second)
  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      if (audio.current) setPosition(audio.current.currentTime);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [isPlaying]);

  useEffect(
    () => () => {
      if (playing === audio.current) playing = null;
    },
    [],
  );

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (!el.paused) return el.pause();
    if (playing && playing !== el) playing.pause();
    playing = el;
    void el.play().catch(() => setIsPlaying(false));
  };

  const seek = (event: React.MouseEvent<HTMLButtonElement>) => {
    const el = audio.current;
    if (!el || !duration) return;
    const box = event.currentTarget.getBoundingClientRect();
    const share = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    el.currentTime = share * duration;
    setPosition(el.currentTime);
    if (el.paused) toggle();
  };

  return (
    <div
      className={cn(
        className,
        'flex w-60 items-center gap-2 py-2 pr-4 pl-2 max-md:w-56',
        mine ? 'bg-dm-mine text-white' : 'bg-secondary text-secondary-foreground',
      )}
    >
      <audio
        ref={audio}
        src={message.mediaUrl ? playableUrl(message.mediaUrl) : undefined}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setPosition(0);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? t('pause') : t('play')}
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2',
          mine
            ? 'hover:bg-white/15 focus-visible:ring-white/70'
            : 'hover:bg-foreground/8 focus-visible:ring-ring',
        )}
      >
        {isPlaying ? (
          <Pause className="size-4.5 fill-current" />
        ) : (
          <Play className="ml-0.5 size-4.5 fill-current" />
        )}
      </button>

      <button
        type="button"
        onClick={seek}
        aria-label={t('seek')}
        tabIndex={-1}
        className="flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-0.5 outline-none"
      >
        {bars.map((height, i) => (
          <span
            key={i}
            className={cn(
              'w-0.75 min-w-0.5 flex-1 rounded-full bg-current transition-opacity duration-150',
              (i + 0.5) / bars.length <= progress ? 'opacity-100' : 'opacity-40',
            )}
            style={{ height: `${Math.max(14, height)}%` }}
          />
        ))}
      </button>

      <span className="min-w-8 shrink-0 text-right text-xs tabular-nums opacity-90">
        {formatVoiceTime(isPlaying || position > 0 ? position : duration)}
      </span>
    </div>
  );
}
