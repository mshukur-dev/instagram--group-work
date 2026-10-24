'use client';

import type { Highlight } from '@instagram/shared';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { cldUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';
import { useHighlightStories } from '../queries';

const IMAGE_MS = 5000;
const noop = () => () => undefined;

type Props = {
  highlight: Highlight | null;
  owner: { username: string; avatarUrl: string | null };
  onClose: () => void;
};

// STORY-8: the stories kept in a highlight, played one after another like stories: bars on
// top fill as each one plays, a tap on the left / right goes back / on, holding pauses, the
// last one closes the viewer. Arrow keys and Escape work too.
export function HighlightViewer({ highlight, owner, onClose }: Props) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {highlight && (
        <Player key={highlight.id} highlight={highlight} owner={owner} onClose={onClose} />
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Player({ highlight, owner, onClose }: Props & { highlight: Highlight }) {
  const t = useTranslations('stories');
  const reduceMotion = useReducedMotion();
  const { data: stories, isPending } = useHighlightStories(highlight.id);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const story = stories?.[index];
  const count = stories?.length ?? 0;

  const next = useCallback(() => {
    setProgress(0);
    if (index + 1 >= count) onClose();
    else setIndex(index + 1);
  }, [index, count, onClose]);
  const prev = () => {
    setProgress(0);
    setIndex((i) => Math.max(0, i - 1));
  };

  // Pictures run on a clock; videos report their own time
  useEffect(() => {
    if (!story || story.mediaType === 'VIDEO' || held) return;
    const startedAt = performance.now() - progress * IMAGE_MS;
    let frame = requestAnimationFrame(function tick(now) {
      const p = Math.min(1, (now - startedAt) / IMAGE_MS);
      setProgress(p);
      if (p >= 1) next();
      else frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
    // progress is read once when (re)starting, not on every frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, held, next]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (held) element.pause();
    else void element.play().catch(() => undefined);
  }, [held, story]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, onClose]);

  // A tap on the left third goes back, anywhere else goes on; a long press only pauses
  const pressedAt = useRef(0);
  const onPointerDown = () => {
    pressedAt.current = Date.now();
    setHeld(true);
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    setHeld(false);
    if (Date.now() - pressedAt.current > 250) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX - rect.left < rect.width / 3) prev();
    else next();
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={highlight.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      className="fixed inset-0 z-80 grid place-items-center bg-neutral-950/95"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('close')}
        className="absolute top-4 right-4 z-10 grid size-10 place-items-center rounded-full text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white max-md:hidden"
      >
        <X className="size-7" />
      </button>

      <motion.div
        initial={reduceMotion ? false : { scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="relative aspect-9/16 h-[min(92dvh,880px)] overflow-hidden rounded-xl bg-neutral-900 max-md:h-dvh max-md:w-full max-md:rounded-none"
      >
        {/* The picture and the tap areas */}
        <div
          className="absolute inset-0 touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHeld(false)}
          onContextMenu={(event) => event.preventDefault()}
        >
          {isPending || !story ? (
            <div className="grid h-full place-items-center">
              <Loader2 className="size-7 animate-spin text-white/60" />
            </div>
          ) : story.mediaType === 'VIDEO' ? (
            <video
              key={story.id}
              ref={video}
              src={cldUrl(story.url, 'c_fill,ar_9:16,w_720,q_auto')}
              poster={story.thumbnailUrl ?? undefined}
              autoPlay
              playsInline
              muted
              onTimeUpdate={(event) => {
                const v = event.currentTarget;
                if (v.duration) setProgress(v.currentTime / v.duration);
              }}
              onEnded={next}
              className="size-full object-cover"
            />
          ) : (
            <img
              key={story.id}
              src={cldUrl(story.url, 'c_fill,ar_9:16,w_1080,f_auto,q_auto')}
              alt=""
              draggable={false}
              className="size-full object-cover"
            />
          )}
        </div>

        {/* Bars, owner and title on a soft dark top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-linear-to-b from-black/55 to-transparent px-3 pt-3 pb-10">
          <div className="flex gap-1">
            {Array.from({ length: Math.max(count, 1) }, (_, i) => (
              <span key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
                <span
                  className="block h-full bg-white"
                  style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
                />
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-white">
            <img
              src={
                highlight.coverUrl
                  ? cldUrl(highlight.coverUrl, 'c_fill,w_80,h_80,f_auto,q_auto')
                  : (owner.avatarUrl ?? '')
              }
              alt=""
              className="size-8 rounded-full object-cover"
            />
            <span className="font-semibold">{owner.username}</span>
            <span className="truncate text-white/80">{highlight.title}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute top-10 right-2 grid size-10 place-items-center text-white md:hidden"
        >
          <X className="size-6" />
        </button>
      </motion.div>

      {/* Desktop arrows beside the frame */}
      <div className="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
        <div className="flex aspect-9/16 h-[min(92dvh,880px)] items-center justify-between">
          <button
            type="button"
            onClick={prev}
            aria-label={t('previous')}
            className={cn(
              'pointer-events-auto -ml-14 grid size-8 place-items-center rounded-full bg-white/85 text-neutral-900 outline-none transition-opacity hover:bg-white focus-visible:ring-2 focus-visible:ring-white',
              index === 0 && 'invisible',
            )}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label={t('next')}
            className="pointer-events-auto -mr-14 grid size-8 place-items-center rounded-full bg-white/85 text-neutral-900 outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
