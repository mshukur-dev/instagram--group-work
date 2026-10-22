'use client';

import { X } from 'lucide-react';
import { useAnimate, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Dialog } from 'radix-ui';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useIsPhone } from '@/lib/use-viewport';
import { usePost } from '../queries';
import { PostDetail } from './post-detail';
import { PostUnavailable } from './post-unavailable';

const sheetEase = [0.32, 0.72, 0, 1] as const;
const ORIGIN_RADIUS = 12;
const PANE_RADIUS = 16;

const originOf = (postId: string) =>
  document.querySelector<HTMLElement>(`[data-post-origin="${CSS.escape(postId)}"]`);

const onScreen = (rect: DOMRect) => rect.bottom > 0 && rect.top < window.innerHeight;

// Where the photo has to be so that it covers `origin`: moved, shrunk, and cut to the origin's
// height. The modal grows out of the post (and shrinks back into it) by running this in reverse.
function coverOrigin(origin: DOMRect, pane: DOMRect) {
  const scale = origin.width / pane.width;
  const cut = Math.max(0, (pane.height - origin.height / scale) / 2);
  const r = ORIGIN_RADIUS / scale;
  return {
    x: origin.left + origin.width / 2 - (pane.left + pane.width / 2),
    y: origin.top + origin.height / 2 - (pane.top + pane.height / 2),
    scale,
    clipPath: `inset(${cut}px 0px ${cut}px 0px round ${r}px ${r}px ${r}px ${r}px)`,
  };
}
const paneAtRest = `inset(0px 0px 0px 0px round ${PANE_RADIUS}px 0px 0px ${PANE_RADIUS}px)`;

// Opened from inside the app (feed, profile), a post lies over the page: the photo lifts out of
// its place and grows into the card while the comments slide in beside it; closing plays it back.
// A modal slot keeps its last page when the app navigates somewhere it has no match for, so the
// modal hides itself once the address is no longer a post.
export function PostModal({ postId }: { postId: string }) {
  const pathname = usePathname();
  if (!pathname.startsWith('/p/')) return null;
  return <Overlay postId={postId} />;
}

function Overlay({ postId }: { postId: string }) {
  const t = useTranslations('post');
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const isPhone = useIsPhone();
  const { data: post, error } = usePost(postId);
  const [scope, animate] = useAnimate<HTMLDivElement>();

  // Opened with the photo already known (from the feed or a grid): it can fly in from there
  const [seeded] = useState(post !== undefined);
  const origin = useRef<HTMLElement | null>(null);
  const paneRect = useRef<DOMRect | null>(null);
  const closing = useRef(false);
  const ready = post !== undefined || error !== null;

  const part = (name: string) => scope.current?.querySelector<HTMLElement>(`[data-part="${name}"]`);

  // The dimmed page fades in at once, even while the post is still loading
  useLayoutEffect(() => {
    const overlay = part('overlay');
    if (overlay) {
      void animate(
        overlay,
        { opacity: [0, 1] },
        { duration: reduceMotion ? 0.15 : 0.35, ease: 'easeOut' },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- plays once, on open
  }, []);

  // Put the page back as it was (the hidden post shows again)
  const restoreOrigin = () => {
    if (origin.current) origin.current.style.visibility = '';
    origin.current = null;
  };

  // The card is set up before the first paint, so there is no flash of the finished card.
  // The cleanup leaves the parts as they were: React runs effects twice in development, and
  // stopping an animation halfway must not leave its values behind for the second run.
  useLayoutEffect(() => {
    if (!ready || !scope.current) return;
    const root = scope.current;
    const card = part('card');
    if (reduceMotion) return;

    const pane = part('pane');
    const found = !isPhone && seeded && pane ? originOf(postId) : null;
    const from = found?.getBoundingClientRect();

    if (isPhone || !card) {
      if (card) {
        void animate(card, { y: ['100%', '0%'] }, { duration: 0.45, ease: sheetEase });
      }
    } else if (pane && found && from && onScreen(from)) {
      const to = pane.getBoundingClientRect();
      paneRect.current = to;
      const start = coverOrigin(from, to);
      origin.current = found;
      // The post stays in the page, hidden, so only one copy of the photo is on screen
      found.style.visibility = 'hidden';

      void animate(
        pane,
        {
          x: [start.x, 0],
          y: [start.y, 0],
          scale: [start.scale, 1],
          clipPath: [start.clipPath, paneAtRest],
        },
        { duration: 0.62, ease: sheetEase },
      );
      const bg = part('bg');
      const panel = part('panel');
      if (bg) {
        void animate(bg, { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.4, delay: 0.14 });
      }
      if (panel) {
        void animate(
          panel,
          { opacity: [0, 1], x: [36, 0] },
          { duration: 0.5, delay: 0.2, ease: sheetEase },
        );
      }
    } else {
      // Nothing to grow from (opened from a link, or the post is out of sight)
      void animate(
        card,
        { opacity: [0, 1], scale: [0.95, 1], y: [14, 0] },
        { duration: 0.4, ease: sheetEase },
      );
    }
    root.focus({ preventScroll: true });

    return () => {
      for (const name of ['card', 'bg', 'pane', 'panel']) {
        const element = part(name);
        if (element) {
          element.style.transform = '';
          element.style.opacity = '';
          element.style.clipPath = '';
        }
      }
      restoreOrigin();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- plays once, when the post is ready
  }, [ready]);

  const close = useCallback(async () => {
    if (closing.current) return;
    closing.current = true;
    const card = part('card');
    const overlay = part('overlay');
    const pane = part('pane');
    const leave = () => {
      restoreOrigin();
      router.back();
    };

    if (reduceMotion || !card) return leave();

    const target = origin.current ? originOf(postId) : null;
    const to = target?.getBoundingClientRect();
    const rest = paneRect.current;

    if (isPhone) {
      void animate(overlay ?? card, { opacity: 0 }, { duration: 0.25 });
      await animate(card, { y: '100%' }, { duration: 0.32, ease: [0.4, 0, 1, 1] });
    } else if (pane && target && to && rest && onScreen(to)) {
      // The photo flies back into its place in the page while the rest dissolves
      const back = coverOrigin(to, rest);
      const bg = part('bg');
      const panel = part('panel');
      if (overlay) void animate(overlay, { opacity: 0 }, { duration: 0.4, delay: 0.1 });
      if (panel) void animate(panel, { opacity: 0, x: 24 }, { duration: 0.22, ease: 'easeIn' });
      if (bg) void animate(bg, { opacity: 0, scale: 0.97 }, { duration: 0.28, ease: 'easeIn' });
      await animate(
        pane,
        { x: back.x, y: back.y, scale: back.scale, clipPath: back.clipPath },
        { duration: 0.46, ease: sheetEase },
      );
    } else {
      if (overlay) void animate(overlay, { opacity: 0 }, { duration: 0.25 });
      await animate(card, { opacity: 0, scale: 0.97, y: 10 }, { duration: 0.25, ease: 'easeIn' });
    }
    leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate and router are stable
  }, [isPhone, postId, reduceMotion]);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && void close()}>
      {/* No portal: the modal slot already sits at the root of the layout */}
      <Dialog.Content
        ref={scope}
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          // A press on the dimmed page around the card closes the modal
          const target = event.target as HTMLElement;
          if (event.target === event.currentTarget || target.dataset.part === 'overlay') {
            void close();
          }
        }}
        className="fixed inset-0 z-50 grid place-items-center overflow-hidden outline-none max-md:block max-md:overflow-y-auto"
      >
        <Dialog.Title className="sr-only">
          {post ? t('postBy', { username: post.author.username }) : t('post')}
        </Dialog.Title>

        <div
          data-part="overlay"
          aria-hidden="true"
          className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
          style={{ opacity: 0 }}
        />

        {/* Desktop: X in the corner of the screen. Phone: the arrow in the post's header */}
        <button
          type="button"
          onClick={() => void close()}
          aria-label={t('close')}
          className="fixed top-4 right-4 z-10 grid size-10 place-items-center rounded-full text-white/90 outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white max-md:hidden"
        >
          <X className="size-6" />
        </button>

        {post ? (
          <PostDetail
            post={post}
            variant="modal"
            onBack={() => void close()}
            onDeleted={() => void close()}
          />
        ) : error ? (
          <div
            data-part="card"
            className="relative w-full max-w-md rounded-2xl bg-card shadow-float-raised max-md:min-h-dvh max-md:max-w-none max-md:rounded-none"
          >
            <PostUnavailable error={error} />
          </div>
        ) : (
          <div
            data-part="card"
            aria-hidden="true"
            className="aspect-square w-[min(560px,calc(100vw-2rem))] animate-pulse rounded-2xl bg-card/90 shadow-float-raised"
          />
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
