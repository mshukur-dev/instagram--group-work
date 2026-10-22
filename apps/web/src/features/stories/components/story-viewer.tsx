'use client';

import { STORY_IMAGE_SECONDS, type Story } from '@instagram/shared';
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { InstagramWordmark } from '@/components/icons/instagram-wordmark';
import { UserAvatar } from '@/components/user-avatar';
import { useMe } from '@/features/profile/queries';
import { cldUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';
import { shortTimeAgo } from '@/lib/time';
import { useRefreshRingsOnClose, useStoriesFeed, useUserStories, useViewStory } from '../queries';
import { StoryViewersSheet } from './story-viewers-sheet';

// Shorter than this, a press is a tap (next / previous); longer, it was a hold (pause)
const TAP_MS = 220;

// Round arrows next to the story (desktop only); they follow the site theme
const arrowClass =
  'grid size-9 place-items-center rounded-full bg-card/90 text-foreground shadow-float backdrop-blur outline-none transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-ring disabled:invisible max-md:hidden';

const rise = { type: 'spring', stiffness: 260, damping: 28 } as const;

// Moving to another person turns the card like a cube side (direction: 1 next, -1 back)
const userSlide: Variants = {
  enter: (dir: number) => ({ x: `${dir * 55}%`, rotateY: dir * -28, scale: 0.88, opacity: 0 }),
  center: { x: 0, rotateY: 0, scale: 1, opacity: 1 },
  exit: (dir: number) => ({ x: `${dir * -55}%`, rotateY: dir * 28, scale: 0.88, opacity: 0 }),
};
const userFade: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};
const iconButton =
  'grid size-8 place-items-center rounded-full text-white outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white';

// STORY-3: full-screen viewer. The story lights up the room: a blurred copy of the current photo
// glows behind the card. Dark theme: a dim, cinematic room; light theme: a white room with a soft
// white bloom around the card. Opening, closing and moving between people are animated.
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
  // 1 when moving forward to the next person, -1 back: sets the side the card turns to
  const [direction, setDirection] = useState(1);
  // The viewer plays its closing animation first, then leaves the page
  const [closing, setClosing] = useState(false);
  const reduceMotion = useReducedMotion();

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
  const leave = () => {
    if (window.history.length > 1) router.back();
    else router.push('/');
  };
  const close = () => setClosing(true);

  // Moves to another person's stories; the address bar follows without reloading the page
  const openUser = (name: string, dir: 1 | -1) => {
    setDirection(dir);
    setCurrent(name);
    setIndex(0);
    window.history.replaceState(null, '', `/stories/${name}`);
  };

  const goNext = () => {
    if (stories && index < stories.length - 1) setIndex(index + 1);
    else if (nextUser) openUser(nextUser, 1);
    else close();
  };

  const goPrevious = () => {
    if (index > 0) setIndex(index - 1);
    else if (previousUser) openUser(previousUser, -1);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (viewersOpen || closing) return;
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

  const running = !paused && !holding && !viewersOpen && !pageHidden && !closing;
  const time = story ? shortTimeAgo(story.createdAt) : null;

  return (
    <motion.div
      // Focused on open, so the arrow keys, Space and Esc work right away
      ref={(node) => node?.focus()}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: reduceMotion ? 0 : closing ? 0.22 : 0.35, ease: 'easeOut' }}
      onAnimationComplete={() => {
        if (closing) leave();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background text-foreground outline-none"
    >
      <Ambient
        src={story ? (story.mediaType === 'VIDEO' ? story.thumbnailUrl : story.url) : null}
      />

      <Link href="/" className="absolute top-6 left-6 z-10 max-md:hidden">
        <InstagramWordmark className="h-8" />
      </Link>
      <motion.button
        type="button"
        onClick={close}
        aria-label={t('close')}
        whileHover={reduceMotion ? undefined : { rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        transition={rise}
        className="absolute top-4 right-4 z-10 grid size-10 place-items-center rounded-full outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring max-md:text-white"
      >
        <X className="size-7" />
      </motion.button>

      <motion.div
        // The card rises in on open, sinks on close and gives a little while held
        initial={reduceMotion ? false : { scale: 0.9, y: 28 }}
        animate={{ scale: closing ? 0.94 : holding ? 0.985 : 1, y: closing ? 16 : 0 }}
        transition={rise}
        className="relative flex items-center gap-5 [perspective:1600px]"
      >
        <motion.button
          type="button"
          onClick={goPrevious}
          disabled={index === 0 && !previousUser}
          aria-label={t('previous')}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className={arrowClass}
        >
          <ChevronLeft className="size-5" />
        </motion.button>

        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.div
            key={current}
            custom={direction}
            variants={reduceMotion ? userFade : userSlide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 240, damping: 30 }}
            className="relative aspect-9/16 h-[min(92dvh,860px)] overflow-hidden rounded-2xl bg-neutral-900 shadow-float-raised ring-1 ring-foreground/10 max-md:h-dvh max-md:rounded-none max-md:ring-0"
          >
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
                            {muted ? (
                              <VolumeX className="size-5" />
                            ) : (
                              <Volume2 className="size-5" />
                            )}
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
          </motion.div>
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={goNext}
          aria-label={t('next')}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className={arrowClass}
        >
          <ChevronRight className="size-5" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// The room around the story: a blurred, enlarged copy of the photo that cross-fades as stories
// change. The light theme adds a white bloom right behind the card, so the page stays airy.
function Ambient({ src }: { src: string | null }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 max-md:hidden">
      <AnimatePresence initial={false}>
        {src && (
          <motion.img
            key={src}
            src={cldUrl(src, 'w_160,f_auto,q_auto')}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute inset-0 size-full scale-125 object-cover blur-[90px] saturate-150"
          />
        )}
      </AnimatePresence>
      {/* Calms the glow down to a tint: stronger veil in the light theme */}
      <div className="absolute inset-0 bg-background/50 dark:bg-background/60" />
      <div className="absolute top-1/2 left-1/2 h-[min(100vh,940px)] w-[min(70vh,640px)] -translate-1/2 rounded-full bg-white opacity-90 blur-[70px] dark:opacity-0" />
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
          className={cn(
            'size-full object-cover transition-opacity duration-300 select-none',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
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
