'use client';

import { X } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Dialog } from 'radix-ui';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIsPhone } from '@/lib/use-viewport';
import { dismissPostModal, usePostModalStore } from '../modal-store';
import { usePost } from '../queries';
import { PostDetail } from './post-detail';
import { PostUnavailable } from './post-unavailable';

// Everything moves with the Web Animations API: transform and opacity only, so the browser runs
// it on the GPU and a busy main thread (a post that is still mounting) cannot make it stutter.
// Long ease-out curves: the photo leaves fast and settles softly.
const OPEN_MS = 640;
const CLOSE_MS = 500;
const settle = 'cubic-bezier(0.22, 1, 0.36, 1)';
const leaveEase = 'cubic-bezier(0.32, 0.72, 0, 1)';

const ORIGIN_RADIUS = 12;
const PANE_RADIUS = '16px 0px 0px 16px';

const originOf = (postId: string) =>
  document.querySelector<HTMLElement>(`[data-post-origin="${CSS.escape(postId)}"]`);

const onScreen = (rect: DOMRect) => rect.bottom > 0 && rect.top < window.innerHeight;

// Where the photo has to be so that it covers `origin`: moved and shrunk, with its corners
// rounded like the post's. If the shapes differ, the photo is also cut to the origin's height.
// The modal grows out of the post (and shrinks back into it) by running this in reverse.
function coverOrigin(origin: DOMRect, pane: DOMRect) {
  const scale = origin.width / pane.width;
  const cut = Math.max(0, (pane.height - origin.height / scale) / 2);
  const radius = `${ORIGIN_RADIUS / scale}px`;
  const x = origin.left + origin.width / 2 - (pane.left + pane.width / 2);
  const y = origin.top + origin.height / 2 - (pane.top + pane.height / 2);
  const crop = cut > 0.5;
  const shape: Keyframe = {
    transform: `translate(${x}px, ${y}px) scale(${scale})`,
    borderRadius: `${radius} ${radius} ${radius} ${radius}`,
    ...(crop && { clipPath: `inset(${cut}px 0px ${cut}px 0px)` }),
  };
  const rest: Keyframe = {
    transform: 'translate(0px, 0px) scale(1)',
    borderRadius: PANE_RADIUS,
    ...(crop && { clipPath: 'inset(0px 0px 0px 0px)' }),
  };
  return { shape, rest };
}

// Opened from inside the app (feed, profile), a post lies over the page at once: the photo lifts
// out of its place and grows into the card while the comments slide in beside it; closing plays
// it back, also for the browser's Back button. A direct link or a reload shows the page instead.
export function PostModalHost() {
  const postId = usePostModalStore((state) => state.postId);
  return postId ? <Overlay key={postId} postId={postId} /> : null;
}

function Overlay({ postId }: { postId: string }) {
  const t = useTranslations('post');
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const isPhone = useIsPhone();
  const { data: post, error } = usePost(postId);
  const root = useRef<HTMLDivElement>(null);

  // Opened with the photo already known (from the feed or a grid): it can fly in from there
  const [seeded] = useState(post !== undefined);
  const origin = useRef<HTMLElement | null>(null);
  const paneRect = useRef<DOMRect | null>(null);
  const running = useRef<Animation[]>([]);
  const closing = useRef(false);
  const sawOwnAddress = useRef(false);
  const followedLink = useRef(false);
  const ready = post !== undefined || error !== null;

  const part = (name: string) => root.current?.querySelector<HTMLElement>(`[data-part="${name}"]`);

  // Put the page back as it was (the hidden post shows again)
  const restoreOrigin = () => {
    if (origin.current) origin.current.style.visibility = '';
    origin.current = null;
  };

  // `fill: both` shows the first frame at once (no flash of the finished card) and keeps the last
  const play = (element: Element, frames: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation = element.animate(frames, { fill: 'both', ...options });
    running.current.push(animation);
    return animation.finished.catch(() => undefined);
  };

  const stopAll = () => {
    running.current.forEach((animation) => animation.cancel());
    running.current = [];
  };

  // The dimmed page fades in at once, even while the post is still loading
  useLayoutEffect(() => {
    const overlay = part('overlay');
    if (overlay) {
      play(overlay, [{ opacity: 0 }, { opacity: 1 }], {
        duration: reduceMotion ? 150 : 300,
        easing: 'ease-out',
      });
    }
    return stopAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- plays once, on open
  }, []);

  // The card is set up before the first paint. The cleanup cancels everything: React runs
  // effects twice in development, and the second run must start from a clean slate.
  useLayoutEffect(() => {
    if (!ready || !root.current) return;
    const card = part('card');
    if (reduceMotion || !card) return;

    const pane = part('pane');
    const found = !isPhone && seeded && pane ? originOf(postId) : null;
    const from = found?.getBoundingClientRect();

    if (isPhone) {
      play(card, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], {
        duration: 480,
        easing: settle,
      });
    } else if (pane && found && from && onScreen(from)) {
      const to = pane.getBoundingClientRect();
      paneRect.current = to;
      const { shape, rest } = coverOrigin(from, to);
      origin.current = found;
      // The post stays in the page, hidden, so only one copy of the photo is on screen
      found.style.visibility = 'hidden';

      play(pane, [shape, rest], { duration: OPEN_MS, easing: settle });
      const bg = part('bg');
      const panel = part('panel');
      if (bg) {
        play(
          bg,
          [
            { opacity: 0, transform: 'scale(0.97)' },
            { opacity: 1, transform: 'scale(1)' },
          ],
          { duration: 460, delay: 120, easing: settle },
        );
      }
      if (panel) {
        play(
          panel,
          [
            { opacity: 0, transform: 'translateX(40px)' },
            { opacity: 1, transform: 'translateX(0)' },
          ],
          { duration: 560, delay: 140, easing: settle },
        );
      }
    } else {
      // Nothing to grow from (the post is out of sight)
      play(
        card,
        [
          { opacity: 0, transform: 'translateY(14px) scale(0.95)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        { duration: 420, easing: settle },
      );
    }
    root.current.focus({ preventScroll: true });

    return () => {
      stopAll();
      restoreOrigin();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- plays once, when the post is ready
  }, [ready]);

  // `source` tells who started the closing: the modal itself (then the address goes one step
  // back) or the browser's Back button (the address has already gone back)
  const close = useCallback(
    async (source: 'ui' | 'history' = 'ui') => {
      if (closing.current) return;
      closing.current = true;
      const card = part('card');
      const overlay = part('overlay');
      const pane = part('pane');
      // The animations are not cancelled here: the parts would jump back for a frame before the
      // modal is gone. Unmounting cleans them up.
      const leave = () => {
        restoreOrigin();
        if (source === 'ui') window.history.back();
        dismissPostModal();
      };

      if (reduceMotion || !card) return leave();

      const target = origin.current ? originOf(postId) : null;
      const to = target?.getBoundingClientRect();
      const rest = paneRect.current;

      if (isPhone) {
        if (overlay) play(overlay, [{ opacity: 1 }, { opacity: 0 }], { duration: 250 });
        await play(card, [{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], {
          duration: 320,
          easing: 'cubic-bezier(0.4, 0, 1, 1)',
        });
      } else if (pane && target && to && rest && onScreen(to)) {
        // The photo flies back into its place in the page while the rest dissolves
        const { shape, rest: atRest } = coverOrigin(to, rest);
        const bg = part('bg');
        const panel = part('panel');
        if (overlay) {
          play(overlay, [{ opacity: 1 }, { opacity: 0 }], {
            duration: CLOSE_MS,
            easing: 'ease-out',
          });
        }
        if (panel) {
          play(
            panel,
            [
              { opacity: 1, transform: 'translateX(0)' },
              { opacity: 0, transform: 'translateX(28px)' },
            ],
            { duration: 220, easing: 'ease-in' },
          );
        }
        if (bg) {
          play(
            bg,
            [
              { opacity: 1, transform: 'scale(1)' },
              { opacity: 0, transform: 'scale(0.97)' },
            ],
            { duration: 280, easing: 'ease-in' },
          );
        }
        await play(pane, [atRest, shape], { duration: CLOSE_MS, easing: leaveEase });
      } else {
        if (overlay) play(overlay, [{ opacity: 1 }, { opacity: 0 }], { duration: 250 });
        await play(
          card,
          [
            { opacity: 1, transform: 'translateY(0) scale(1)' },
            { opacity: 0, transform: 'translateY(10px) scale(0.97)' },
          ],
          { duration: 250, easing: 'ease-in' },
        );
      }
      leave();
    },
    [isPhone, postId, reduceMotion],
  );

  // The address changed while the modal was open. If a link inside the modal was followed (a
  // profile, a hashtag), the modal just goes; otherwise it was the browser's Back button, and the
  // modal closes with the same animation as its own close button.
  useEffect(() => {
    if (pathname === `/p/${postId}`) sawOwnAddress.current = true;
    else if (sawOwnAddress.current && !closing.current) {
      if (followedLink.current) {
        closing.current = true;
        restoreOrigin();
        dismissPostModal();
      } else {
        void close('history');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to the address only
  }, [pathname]);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && void close()}>
      {/* No portal: the host already sits at the root of the layout */}
      <Dialog.Content
        ref={root}
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          followedLink.current = Boolean((event.target as HTMLElement).closest('a[href]'));
        }}
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

        {/* No blur here: blurring the page behind a moving photo is repainted on every frame */}
        <div
          data-part="overlay"
          aria-hidden="true"
          className="absolute inset-0 bg-black/65"
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
