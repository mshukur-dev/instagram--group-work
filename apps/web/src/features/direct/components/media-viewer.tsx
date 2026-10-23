'use client';

import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  type PanInfo,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserAvatar } from '@/components/user-avatar';
import { cldUrl, videoPoster } from '@/lib/cloudinary';
import { shortTimeAgo } from '@/lib/time';
import { useIsPhone } from '@/lib/use-viewport';
import { mediaKey, originOf, useMediaViewer } from '../media-viewer-store';
import { useMessages } from '../queries';

type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius: number;
  opacity: number;
};

// Soft but quick: the photo grows out of the chat and lands without wobbling
const SPRING = { type: 'spring', stiffness: 340, damping: 34, mass: 0.9 } as const;

function findThumb(key: string): HTMLElement | null {
  const exact = document.querySelector<HTMLElement>(`[data-media-id="${CSS.escape(key)}"]`);
  if (exact) return exact;
  // A photo deep in a stack is not drawn: fly back to the top of its stack instead
  return document.querySelector<HTMLElement>(
    `[data-media-group~="${CSS.escape(key)}"] [data-stack-top]`,
  );
}

// Full-screen photos and videos of one chat. Opens out of the thumbnail that was clicked,
// pages through every photo and video of the chat (arrows, keys, swipe) and flies back into
// the chat when closed (Esc, the cross, a click beside the photo, a swipe up or down).
export function MediaViewer({ conversationId }: { conversationId: string }) {
  const messageId = useMediaViewer((s) => s.messageId);

  // Leaving the chat closes the viewer, so it does not reopen in the next one
  useEffect(() => () => useMediaViewer.getState().hide(), [conversationId]);

  if (!messageId) return null;
  return createPortal(<Viewer conversationId={conversationId} />, document.body);
}

function Viewer({ conversationId }: { conversationId: string }) {
  const t = useTranslations('direct.viewer');
  const tTime = useTranslations('time');
  const { messageId, origin, go, hide } = useMediaViewer();
  const messages = useMessages(conversationId);
  const phone = useIsPhone();
  const reduceMotion = useReducedMotion();

  // Every photo and video of the chat that is loaded, oldest first
  const media = useMemo(
    () =>
      (messages.data?.pages.flatMap((p) => p.items) ?? [])
        .filter((m) => m.type === 'MEDIA' && m.mediaUrl && !m.isDeleted)
        .reverse(),
    [messages.data],
  );
  const index = media.findIndex((m) => mediaKey(m) === messageId);
  const current = media[index];
  const key = current ? mediaKey(current) : null;

  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Proportions of each picture, known once it has loaded (the first one from its thumbnail)
  const [aspects, setAspects] = useState<Record<string, number>>(() =>
    messageId && origin ? { [messageId]: origin.aspect } : {},
  );
  const setAspect = (k: string, width: number, height: number) => {
    if (!width || !height) return;
    setAspects((all) => (all[k] ? all : { ...all, [k]: width / height }));
  };

  // The largest box of the picture's shape that fits the screen
  const fit = (aspect: number): Box => {
    const padX = phone ? 0 : 96;
    const padTop = phone ? 64 : 72;
    const padBottom = phone ? 40 : 56;
    const maxW = viewport.width - padX * 2;
    const maxH = viewport.height - padTop - padBottom;
    const width = Math.min(maxW, maxH * aspect);
    const height = width / aspect;
    return {
      left: (viewport.width - width) / 2,
      top: padTop + (maxH - height) / 2,
      width,
      height,
      borderRadius: phone ? 0 : 12,
      opacity: 1,
    };
  };
  const aspect = key ? aspects[key] : undefined;
  const lastBox = useRef<Box | null>(null);
  const target = aspect ? fit(aspect) : (lastBox.current ?? fit(1));
  lastBox.current = target;

  const [closing, setClosing] = useState<Box | null>(null);
  const close = () => {
    if (closing) return;
    const thumb = key ? findThumb(key) : null;
    if (thumb && !reduceMotion) {
      const o = originOf(thumb);
      if (o.top + o.height > 0 && o.top < viewport.height) {
        setClosing({ ...o, borderRadius: o.radius, opacity: 1 });
        return;
      }
    }
    // The thumbnail is scrolled away: just fade out where it is
    setClosing({ ...target, opacity: 0 });
  };
  const prev = () => {
    const before = media[index - 1];
    if (before && !closing) go(mediaKey(before));
  };
  const next = () => {
    const after = media[index + 1];
    if (after && !closing) go(mediaKey(after));
  };

  // The message was unsent (or the chat changed) while it was open
  useEffect(() => {
    if (index === -1) hide();
  }, [index, hide]);

  // Keys: Esc closes, arrows page
  const keys = useRef({ close, prev, next });
  keys.current = { close, prev, next };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') keys.current.close();
      else if (event.key === 'ArrowLeft') keys.current.prev();
      else if (event.key === 'ArrowRight') keys.current.next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The thumbnail in the chat is hidden while its picture is "out", so it seems to fly
  useEffect(() => {
    if (!key) return;
    const thumb = document.querySelector<HTMLElement>(`[data-media-id="${CSS.escape(key)}"]`);
    if (!thumb) return;
    thumb.style.visibility = 'hidden';
    return () => {
      thumb.style.visibility = '';
    };
  }, [key]);

  // Focus goes to the viewer and back to where it was
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeButton.current?.focus({ preventScroll: true });
    return () => before?.focus({ preventScroll: true });
  }, []);

  // Dragging the photo up or down dims the background, letting go far enough closes it
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dim = useTransform(y, [-320, 0, 320], [0.3, 1, 0.3]);
  const onDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const { offset, velocity } = info;
    if (Math.abs(offset.y) > Math.abs(offset.x)) {
      if (Math.abs(offset.y) > 110 || Math.abs(velocity.y) > 700) close();
    } else if (offset.x < -70 || velocity.x < -600) next();
    else if (offset.x > 70 || velocity.x > 600) prev();
  };

  if (!current || !key) return null;

  const isVideo = current.mediaType === 'VIDEO';
  const url = current.mediaUrl ?? '';
  const thumb = isVideo ? videoPoster(url) : cldUrl(url, 'w_480,f_auto,q_auto');
  const ago = shortTimeAgo(current.createdAt);
  const chrome = closing ? 0 : 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('label')}
      className="fixed inset-0 z-100 overscroll-contain text-white"
    >
      {/* Solid black with the picture's own colors glowing in it. The glow is blown up past the
          screen edges, where the blur fades out, so it tints the whole screen evenly. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: closing ? 0.22 : 0.3, ease: 'easeOut' }}
        onClick={close}
        className="absolute inset-0"
      >
        <motion.div style={{ opacity: dim }} className="absolute inset-0 overflow-hidden bg-black">
          {thumb && (
            <img
              src={thumb}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 size-full scale-150 object-cover opacity-35 blur-3xl saturate-150"
            />
          )}
        </motion.div>
      </motion.div>

      {/* Top bar: who sent it and when, which one of how many, close */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: chrome, y: 0 }}
        transition={{ duration: 0.2, delay: closing ? 0 : 0.08 }}
        style={{ opacity: dim }}
        className="absolute inset-x-0 top-0 flex h-16 items-center gap-3 px-4 max-md:h-14 max-md:px-3"
      >
        <Link
          href={`/${current.sender.username}`}
          className="flex min-w-0 items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <UserAvatar src={current.sender.avatarUrl} alt="" size={32} />
          <span className="min-w-0 text-sm leading-tight">
            <span className="block truncate font-semibold">{current.sender.username}</span>
            <span className="block text-white/60">{tTime(ago.unit, { count: ago.count })}</span>
          </span>
        </Link>
        <span className="flex-1" />
        {media.length > 1 && (
          <span className="text-sm text-white/70 tabular-nums">
            {t('counter', { current: index + 1, total: media.length })}
          </span>
        )}
        <button
          ref={closeButton}
          type="button"
          onClick={close}
          aria-label={t('close')}
          className="grid size-10 place-items-center rounded-full outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <X className="size-6" />
        </button>
      </motion.header>

      {/* The picture: grows out of its thumbnail, morphs to the next one's shape */}
      <motion.div
        initial={
          origin && !reduceMotion
            ? {
                left: origin.left,
                top: origin.top,
                width: origin.width,
                height: origin.height,
                borderRadius: origin.radius,
                opacity: 1,
              }
            : { ...target, opacity: 0 }
        }
        animate={closing ?? target}
        transition={SPRING}
        onAnimationComplete={() => {
          if (closing) hide();
        }}
        drag={!isVideo && !closing}
        dragDirectionLock
        dragSnapToOrigin
        dragElastic={0.5}
        onDragEnd={onDragEnd}
        style={{ x, y }}
        className={
          isVideo
            ? 'absolute overflow-hidden bg-black shadow-2xl'
            : 'absolute cursor-grab touch-none overflow-hidden bg-white/5 shadow-2xl active:cursor-grabbing'
        }
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={key}
            initial={{ opacity: 0 }}
            animate={{ opacity: aspect ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0"
          >
            {isVideo ? (
              <video
                src={url}
                poster={thumb ?? undefined}
                autoPlay
                controls
                playsInline
                onLoadedMetadata={(event) =>
                  setAspect(key, event.currentTarget.videoWidth, event.currentTarget.videoHeight)
                }
                className="size-full object-cover"
              />
            ) : (
              <SharpImage
                thumb={thumb ?? url}
                full={cldUrl(url, 'w_1600,f_auto,q_auto')}
                onSize={(w, h) => setAspect(key, w, h)}
              />
            )}
          </motion.div>
        </AnimatePresence>
        {!aspect && (
          <Loader2 className="absolute top-1/2 left-1/2 size-7 -translate-1/2 animate-spin text-white/70" />
        )}
      </motion.div>

      {/* Paging arrows (a phone swipes instead) */}
      {!phone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: chrome }}
          transition={{ duration: 0.2, delay: closing ? 0 : 0.1 }}
        >
          {index > 0 && (
            <ArrowButton side="left" label={t('previous')} onClick={prev}>
              <ChevronLeft className="size-6" />
            </ArrowButton>
          )}
          {index < media.length - 1 && (
            <ArrowButton side="right" label={t('next')} onClick={next}>
              <ChevronRight className="size-6" />
            </ArrowButton>
          )}
        </motion.div>
      )}
    </div>
  );
}

// The small thumbnail (already loaded in the chat) shows at once; the sharp one fades over it
function SharpImage({
  thumb,
  full,
  onSize,
}: {
  thumb: string;
  full: string;
  onSize: (width: number, height: number) => void;
}) {
  const [sharp, setSharp] = useState(false);
  return (
    <>
      <img
        src={thumb}
        alt=""
        draggable={false}
        onLoad={(event) =>
          onSize(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)
        }
        className="absolute inset-0 size-full object-cover select-none"
      />
      <img
        src={full}
        alt=""
        draggable={false}
        onLoad={(event) => {
          onSize(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
          setSharp(true);
        }}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-300 select-none ${sharp ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  );
}

function ArrowButton({
  side,
  label,
  onClick,
  children,
}: {
  side: 'left' | 'right';
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/12 outline-none backdrop-blur-md transition-[background-color,scale] hover:bg-white/22 focus-visible:ring-2 focus-visible:ring-white/60 active:scale-90 ${side === 'left' ? 'left-6' : 'right-6'}`}
    >
      {children}
    </button>
  );
}
