'use client';

import type { Post } from '@instagram/shared';
import { MessageCircle, Play, Send, Volume2, VolumeX } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { storyRing } from '@/components/story-avatar';
import { UserAvatar } from '@/components/user-avatar';
import { useShareStore } from '@/features/direct/share/share-store';
import {
  DoubleTapHeart,
  makeTapHeart,
  type TapHeart,
} from '@/features/posts/components/double-tap-heart';
import { iconButtonBase } from '@/features/posts/components/icon-button';
import { LikeButton } from '@/features/posts/components/like-button';
import { SaveButton } from '@/features/posts/components/save-button';
import { useLikePost, useSavePost } from '@/features/posts/queries';
import { cldUrl, videoPoster } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/stores/player-store';
import { useViewReel } from '../queries';
import { ReelComments } from './reel-comments';

// Two clicks closer than this are a double click (like), not two pauses
const DOUBLE_CLICK_MS = 250;

// REELS-3, REELS-4: one reel filling the screen. Plays while it is mostly on screen, a click
// pauses, a double click likes; the sound switch is shared by all reels.
export function ReelItem({ reel }: { reel: Post }) {
  const t = useTranslations('reels');
  const tPost = useTranslations('post');
  const format = useFormatter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ref, inView } = useInView({ threshold: 0.6 });
  const muted = usePlayerStore((state) => state.muted);
  const toggleMuted = usePlayerStore((state) => state.toggleMuted);
  const like = useLikePost(reel.id);
  const save = useSavePost(reel.id);
  const { mutate: countView } = useViewReel();
  const [paused, setPaused] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [hearts, setHearts] = useState<TapHeart[]>([]);
  const heartId = useRef(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const counted = useRef(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const video = reel.media[0];
  const poster = video?.thumbnailUrl ?? (video ? videoPoster(video.url) : null);
  const compact = (n: number) => format.number(n, { notation: 'compact' });

  // The reel on screen plays from where it stopped; the others wait
  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (inView) {
      setPaused(false);
      // Not enough loaded to play on: spin until the `playing` event
      setBuffering(element.readyState < HTMLMediaElement.HAVE_FUTURE_DATA);
      element.play().catch(() => setPaused(true));
      if (!counted.current) {
        counted.current = true;
        countView(reel.id);
      }
    } else {
      element.pause();
      setBuffering(false);
      // Comments belong to the reel on screen: scrolling on closes them
      setCommentsOpen(false);
    }
  }, [inView, reel.id, countView]);

  const togglePause = () => {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) {
      void element.play();
      setPaused(false);
    } else {
      element.pause();
      setPaused(true);
    }
  };

  const onVideoClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      if (!reel.isLiked) like.mutate(true);
      // The same gradient heart as on posts, where the finger landed
      const rect = event.currentTarget.getBoundingClientRect();
      const id = (heartId.current += 1);
      setHearts((current) => [
        ...current,
        makeTapHeart(id, event.clientX - rect.left, event.clientY - rect.top),
      ]);
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      togglePause();
    }, DOUBLE_CLICK_MS);
  };

  const counter = 'text-xs font-semibold';

  return (
    <section
      ref={ref}
      data-reel-id={reel.id}
      className="relative flex h-full snap-start snap-always items-center justify-center py-4 max-md:py-0"
    >
      {/* Video and buttons stay centered; the comments panel opens beside them (absolute) */}
      <div className="relative flex h-full gap-4 max-md:static max-md:w-full">
        <div className="relative aspect-9/16 h-full overflow-hidden rounded-lg bg-black max-md:aspect-auto max-md:w-full max-md:rounded-none">
          {video && (
            <video
              ref={videoRef}
              src={cldUrl(video.url, 'c_fill,ar_9:16,w_720,q_auto')}
              poster={poster ? cldUrl(poster, 'c_fill,ar_9:16,w_720,f_auto,q_auto') : undefined}
              muted={muted}
              loop
              playsInline
              preload="metadata"
              onWaiting={() => setBuffering(true)}
              onPlaying={() => setBuffering(false)}
              onClick={onVideoClick}
              className="size-full cursor-pointer object-cover"
            />
          )}

          {/* Everything on the video stays white in both themes */}
          <button
            type="button"
            onClick={toggleMuted}
            aria-label={muted ? t('unmute') : t('mute')}
            className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-black/50 text-white outline-none transition-colors hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-white"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>

          {/* Slow connection: the video waits for data, a spinner turns in the middle */}
          {buffering && !paused && (
            <span
              role="status"
              aria-label={t('loading')}
              className="pointer-events-none absolute inset-0 grid place-items-center"
            >
              <span className="size-12 animate-spin rounded-full border-4 border-white/30 border-t-white drop-shadow" />
            </span>
          )}

          {paused && (
            <span className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="grid size-18 place-items-center rounded-full bg-black/40">
                <Play className="size-9 fill-white text-white" />
              </span>
            </span>
          )}

          {hearts.map((heart) => (
            <DoubleTapHeart
              key={heart.id}
              heart={heart}
              onDone={() => setHearts((current) => current.filter((h) => h.id !== heart.id))}
            />
          ))}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-2 bg-linear-to-t from-black/70 to-transparent p-4 pt-16 text-sm text-white max-md:pr-16">
            <Link
              href={`/${reel.author.username}`}
              className="pointer-events-auto flex w-fit items-center gap-2 font-semibold"
            >
              <UserAvatar
                src={reel.author.avatarUrl}
                alt={reel.author.username}
                size={32}
                ring={storyRing(reel.author)}
              />
              {reel.author.username}
            </Link>
            {reel.caption && <p className="line-clamp-2">{reel.caption}</p>}
            <p className="flex items-center gap-1 text-xs text-white/80">
              <Play className="size-3 fill-current" />
              {t('views', { count: reel.viewsCount, formatted: compact(reel.viewsCount) })}
            </p>
          </div>
        </div>

        {/* Desktop: a column next to the video; phone: on the video's right edge */}
        <div className="flex flex-col items-center gap-5 self-end pb-6 max-md:absolute max-md:right-3 max-md:bottom-4 max-md:pb-0 max-md:text-white">
          <div className="flex flex-col items-center gap-1">
            <LikeButton liked={reel.isLiked} onToggle={(next) => like.mutate(next)} />
            <span className={counter}>{compact(reel.likesCount)}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setCommentsOpen((open) => !open)}
              aria-label={tPost('comment')}
              aria-expanded={commentsOpen}
              className={iconButtonBase}
            >
              <MessageCircle
                className={cn('size-6 -scale-x-100', commentsOpen && 'fill-current')}
              />
            </button>
            <span className={counter}>{compact(reel.commentsCount)}</span>
          </div>
          <button
            type="button"
            aria-label={tPost('share')}
            onClick={() => useShareStore.getState().open(reel)}
            className={iconButtonBase}
          >
            <Send className="size-6" />
          </button>
          <SaveButton saved={reel.isSaved} onToggle={(next) => save.mutate(next)} />
        </div>

        {commentsOpen && <ReelComments reel={reel} onClose={() => setCommentsOpen(false)} />}
      </div>
    </section>
  );
}
