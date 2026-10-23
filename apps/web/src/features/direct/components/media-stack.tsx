'use client';

import { Images, Play } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { cldUrl, videoPoster } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '../api';
import { mediaKey, openMediaViewer } from '../media-viewer-store';

// What a photo or video looks like inside a chat thumbnail (a video shows its first frame)
function Picture({ message, width }: { message: ChatMessage; width: number }) {
  const url = message.mediaUrl ?? '';
  if (message.mediaType === 'VIDEO') {
    const poster = videoPoster(url, `so_0,w_${width},f_auto,q_auto`);
    return poster ? (
      <img
        src={poster}
        alt=""
        loading="lazy"
        draggable={false}
        className="size-full object-cover"
      />
    ) : (
      <video src={url} preload="metadata" muted playsInline className="size-full object-cover" />
    );
  }
  return (
    <img
      src={cldUrl(url, `w_${width},f_auto,q_auto`)}
      alt=""
      loading="lazy"
      draggable={false}
      className="size-full object-cover"
    />
  );
}

function PlayBadge({ small }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute top-1/2 left-1/2 grid -translate-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md',
        small ? 'size-9' : 'size-12',
      )}
    >
      <Play className={cn('translate-x-px fill-current', small ? 'size-4' : 'size-5')} />
    </span>
  );
}

/** One photo or video in the chat; a click opens it full screen */
export function MediaThumb({ message }: { message: ChatMessage }) {
  const t = useTranslations('direct.viewer');
  const key = mediaKey(message);
  const isVideo = message.mediaType === 'VIDEO';
  return (
    <button
      type="button"
      data-media-id={key}
      onClick={(event) => openMediaViewer(key, event.currentTarget)}
      aria-label={isVideo ? t('openVideo') : t('openPhoto')}
      className="relative block max-h-90 w-60 overflow-hidden rounded-[22px] bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Picture message={message} width={480} />
      {isVideo && <PlayBadge />}
    </button>
  );
}

// Each card's place in the pile, and where it goes when the pile fans out on hover. The cards
// underneath peek out towards the middle of the chat (d = -1 for my photos on the right, 1 for
// others' on the left), so the fan never runs off the edge.
const restPose = (i: number, d: number) =>
  [
    { rotate: 0, x: 0, y: 0, scale: 1 },
    { rotate: 5 * d, x: 14 * d, y: 4, scale: 0.97 },
    { rotate: 9 * d, x: 26 * d, y: 9, scale: 0.94 },
  ][i] ?? {};
const fanPose = (i: number, d: number) =>
  [
    { rotate: -2 * d, x: -4 * d, y: -6, scale: 1.02 },
    { rotate: 9 * d, x: 52 * d, y: 2, scale: 0.97 },
    { rotate: 17 * d, x: 96 * d, y: 14, scale: 0.94 },
  ][i] ?? {};
const CARD_SPRING = { type: 'spring', stiffness: 420, damping: 26 } as const;

/**
 * Several photos sent together: a small pile of prints, the first one on top and the next two
 * peeking out tilted. Hovering fans them out; a click opens the first one full screen, from
 * where the rest are a swipe away.
 */
export function MediaStack({ messages, mine }: { messages: ChatMessage[]; mine: boolean }) {
  const t = useTranslations('direct.viewer');
  const reduceMotion = useReducedMotion();
  const shown = messages.slice(0, 3);
  const cover = messages[0];
  if (!cover) return null;
  const coverKey = mediaKey(cover);
  const d = mine ? -1 : 1;

  return (
    <motion.button
      type="button"
      initial={false}
      animate="rest"
      whileHover={reduceMotion ? undefined : 'fan'}
      whileFocus={reduceMotion ? undefined : 'fan'}
      whileTap={{ scale: 0.98 }}
      data-media-group={messages.map(mediaKey).join(' ')}
      onClick={(event) => {
        const top = event.currentTarget.querySelector<HTMLElement>('[data-stack-top]');
        if (top) openMediaViewer(coverKey, top);
      }}
      aria-label={t('openAlbum', { count: messages.length })}
      className={cn(
        'relative h-68 w-57 shrink-0 rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
        mine ? 'mr-1' : 'ml-1',
      )}
    >
      {shown.map((message, i) => {
        const key = mediaKey(message);
        return (
          <motion.span
            key={key}
            data-media-id={key}
            data-stack-top={i === 0 ? '' : undefined}
            variants={{ rest: restPose(i, d), fan: fanPose(i, d) }}
            transition={CARD_SPRING}
            style={{ zIndex: shown.length - i }}
            className="absolute inset-x-3.5 inset-y-2.5 overflow-hidden rounded-[18px] border-[3px] border-background bg-muted shadow-[0_10px_24px_-14px_rgb(0_0_0/0.55)]"
          >
            <Picture message={message} width={400} />
            {message.mediaType === 'VIDEO' && <PlayBadge small />}
            {i === 0 && (
              <motion.span
                key={messages.length}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 600, damping: 22 }}
                className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-xs font-semibold text-white tabular-nums backdrop-blur-md"
              >
                <Images className="size-3.5" />
                {messages.length}
              </motion.span>
            )}
          </motion.span>
        );
      })}
    </motion.button>
  );
}
