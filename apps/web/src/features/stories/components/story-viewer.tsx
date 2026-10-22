'use client';

import { STORY_IMAGE_SECONDS, type Story } from '@instagram/shared';
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { InstagramWordmark } from '@/components/icons/instagram-wordmark';
import { UserAvatar } from '@/components/user-avatar';
import { useMe } from '@/features/profile/queries';
import { cldUrl } from '@/lib/cloudinary';
import { shortTimeAgo } from '@/lib/time';
import { useRefreshRingsOnClose, useStoriesFeed, useUserStories, useViewStory } from '../queries';
import { StoryViewersSheet } from './story-viewers-sheet';

// Shorter than this, a press is a tap (next / previous); longer, it was a hold (pause)
const TAP_MS = 220;

// Round arrows next to the story (desktop only)
const arrowClass =
  'grid size-8 place-items-center rounded-full bg-white/90 text-neutral-900 transition-colors hover:bg-white disabled:invisible max-md:hidden';
const iconButton =
  'grid size-8 place-items-center rounded-full text-white outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white';

// STORY-3: full-screen viewer, always on a dark backdrop like Instagram (the photo reads better).
// Progress bars on top; a tap on the left third goes back, anywhere else forward; holding the
// story (or the pause button, or Space) pauses it. After the last story it moves on to the next
// person in the tray. STORY-5: on my own story "Seen by" opens the list of viewers.
export function StoryViewer({ username }: { username: string }) {
  const t = useTranslations('stories');
  const tTime = useTranslations('time');
  const router = useRouter();
  const { data: me } = useMe();
  const { data: trays } = useStoriesFeed();
  const markSeen = useViewStory().mutate;
  const refreshRings = useRefreshRingsOnClose();

  // Whose stories are on screen now and which one of them
  const [current, setCurrent] = useState(username);
  const [index, setIndex] = useState(0);
  // The people in the tray order, remembered once on open: the tray re-sorts itself as
  // stories get seen, and the viewer must keep walking along the order it started with
  const [order, setOrder] = useState<string[]>([]);
  const { data: stories, isError } = useUserStories(current);

  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [muted, setMuted] = useState(true);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);

  useEffect(() => {
    if (order.length === 0 && trays) setOrder(trays.map((tray) => tray.user.username));
  }, [order, trays]);

  // Rings in the profile, post headers and feed are refreshed once, when the viewer closes
  useEffect(() => () => refreshRings(), [refreshRings]);

  // A story in a background tab does not run on
  useEffect(() => {
    const onChange = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const story = stories?.[index];
  const position = order.indexOf(current);
  const nextUser = position >= 0 ? order[position + 1] : undefined;
  const previousUser = position > 0 ? order[position - 1] : undefined;
  const isMine = Boolean(story && me && story.author.id === me.id);

  // Back to wherever the viewer was opened from (feed, profile); straight links go home
  const close = () => {
    if (window.history.length > 1) router.back();
    else router.push('/');
  };

  // Moves to another person's stories; the address bar follows without reloading the page
  const openUser = (name: string) => {
    setCurrent(name);
    setIndex(0);
    window.history.replaceState(null, '', `/stories/${name}`);
  };

  const goNext = () => {
    if (stories && index < stories.length - 1) setIndex(index + 1);
    else if (nextUser) openUser(nextUser);
    else close();
  };

  const goPrevious = () => {
    if (index > 0) setIndex(index - 1);
    else if (previousUser) openUser(previousUser);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (viewersOpen) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowRight') goNext();
    if (event.key === 'ArrowLeft') goPrevious();
    if (event.key === ' ') {
      event.preventDefault();
      setPaused((value) => !value);
    }
  };

  // Each story is marked as seen once it is on screen: the rings turn gray (STORY-4)
  useEffect(() => {
    if (story && !story.isSeen) markSeen(story.id);
  }, [story, markSeen]);

  // A new story starts unpaused and with the viewers list closed
  useEffect(() => {
    setPaused(false);
    setViewersOpen(false);
  }, [story?.id]);

  const running = !paused && !holding && !viewersOpen && !pageHidden;
  const time = story ? shortTimeAgo(story.createdAt) : null;

  return (
    <div
      // Focused on open, so the arrow keys, Space and Esc work right away
      ref={(node) => node?.focus()}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 text-white outline-none"
    >
      <Link href="/" className="absolute top-6 left-6 max-md:hidden">
        <InstagramWordmark className="h-8" />
      </Link>
      <button
        type="button"
        onClick={close}
        aria-label={t('close')}
        className="absolute top-4 right-4 z-10 grid size-10 place-items-center rounded-full transition-colors hover:bg-white/15"
      >
        <X className="size-7" />
      </button>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={goPrevious}
          disabled={index === 0 && !previousUser}
          aria-label={t('previous')}
          className={arrowClass}
        >
          <ChevronLeft className="size-5" />
        </button>

        <div className="relative aspect-9/16 h-[min(92dvh,860px)] overflow-hidden rounded-xl bg-neutral-900 max-md:h-dvh max-md:rounded-none">
          {isError || (stories && stories.length === 0) ? (
            <p className="grid size-full place-items-center px-6 text-center text-sm text-white/70">
              {t('empty')}
            </p>
          ) : (
            story &&
            stories && (
              <StoryFrame
                key={story.id}
                story={story}
                stories={stories}
                index={index}
                running={running}
                muted={muted}
                onEnd={goNext}
                onTapBack={goPrevious}
                onTapForward={goNext}
                onHold={setHolding}
                header={
                  <div className="flex items-center gap-2 text-sm">
                    <UserAvatar
                      src={story.author.avatarUrl}
                      alt={story.author.username}
                      size={32}
                    />
                    <Link href={`/${story.author.username}`} className="font-semibold">
                      {story.author.username}
                    </Link>
                    {time && (
                      <span className="text-white/70">
                        {tTime(time.unit, { count: time.count })}
                      </span>
                    )}
                    <span className="ml-auto flex items-center">
                      <button
                        type="button"
                        onClick={() => setPaused((value) => !value)}
                        aria-label={t(paused ? 'play' : 'pause')}
                        className={iconButton}
                      >
                        {paused ? (
                          <Play className="size-5 fill-white" />
                        ) : (
                          <Pause className="size-5 fill-white" />
                        )}
                      </button>
                      {story.mediaType === 'VIDEO' && (
                        <button
                          type="button"
                          onClick={() => setMuted((value) => !value)}
                          aria-label={t(muted ? 'unmute' : 'mute')}
                          className={iconButton}
                        >
                          {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                        </button>
                      )}
                    </span>
                  </div>
                }
                footer={
                  isMine && (
                    <StoryViewersSheet
                      story={story}
                      open={viewersOpen}
                      onOpenChange={setViewersOpen}
                    />
                  )
                }
              />
            )
          )}
        </div>

        <button type="button" onClick={goNext} aria-label={t('next')} className={arrowClass}>
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}

type FrameProps = {
  story: Story;
  stories: Story[];
  index: number;
  running: boolean;
  muted: boolean;
  onEnd: () => void;
  onTapBack: () => void;
  onTapForward: () => void;
  onHold: (holding: boolean) => void;
  header: React.ReactNode;
  footer: React.ReactNode;
};

// One story on screen. The running bar is the timer: a photo stays STORY_IMAGE_SECONDS,
// a video its own length; while paused both the bar and the video stand still.
function StoryFrame({
  story,
  stories,
  index,
  running,
  muted,
  onEnd,
  onTapBack,
  onTapForward,
  onHold,
  header,
  footer,
}: FrameProps) {
  const t = useTranslations('stories');
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [loaded, setLoaded] = useState(false);
  const pressedAt = useRef(0);
  // Time a photo has been on screen, kept across pauses
  const elapsedRef = useRef(0);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  });

  const isVideo = story.mediaType === 'VIDEO';
  const active = running && loaded;

  // The bar is moved straight in the DOM every frame, no React re-render per frame
  useEffect(() => {
    const video = videoRef.current;
    if (isVideo && video) {
      if (active) void video.play().catch(() => undefined);
      else video.pause();
    }
    if (!active) return;

    const total = STORY_IMAGE_SECONDS * 1000;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      let progress: number;
      if (isVideo && video) {
        progress = video.duration ? video.currentTime / video.duration : 0;
      } else {
        elapsedRef.current += now - last;
        last = now;
        progress = elapsedRef.current / total;
      }
      if (barRef.current) barRef.current.style.width = `${Math.min(progress, 1) * 100}%`;
      if (!isVideo && progress >= 1) {
        onEndRef.current();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, isVideo]);

  // A press shorter than TAP_MS is a tap; a longer one only paused the story
  const pressZone = (onTap: () => void) => ({
    onPointerDown: () => {
      pressedAt.current = performance.now();
      onHold(true);
    },
    onPointerUp: () => {
      onHold(false);
      if (performance.now() - pressedAt.current < TAP_MS) onTap();
    },
    onPointerLeave: () => onHold(false),
    // Enter / Space on the focused zone (no pointer involved)
    onClick: (event: React.MouseEvent) => {
      if (event.detail === 0) onTap();
    },
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  });

  return (
    <>
      {isVideo ? (
        <video
          ref={videoRef}
          src={cldUrl(story.url, 'f_auto,q_auto')}
          poster={story.thumbnailUrl ?? undefined}
          muted={muted}
          playsInline
          onLoadedData={() => setLoaded(true)}
          onEnded={onEnd}
          className="size-full object-cover"
        />
      ) : (
        <img
          src={cldUrl(story.url, 'w_1080,f_auto,q_auto')}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className="size-full object-cover select-none"
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-black/60 to-transparent" />

      {/* One bar per story; the current one fills up as the story plays */}
      <div className="absolute inset-x-2 top-2 flex gap-1">
        {stories.map((item, i) => (
          <span key={item.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
            {i < index && <span className="block size-full bg-white" />}
            {i === index && <span ref={barRef} className="block h-full w-0 bg-white" />}
          </span>
        ))}
      </div>

      {/* Invisible tap zones over the story: left third back, the rest forward */}
      <button
        type="button"
        aria-label={t('previous')}
        className="absolute inset-y-16 left-0 w-1/3 touch-none"
        {...pressZone(onTapBack)}
      />
      <button
        type="button"
        aria-label={t('next')}
        className="absolute inset-y-16 right-0 w-2/3 touch-none"
        {...pressZone(onTapForward)}
      />

      <div className="absolute inset-x-3 top-5">{header}</div>
      {footer}
    </>
  );
}
