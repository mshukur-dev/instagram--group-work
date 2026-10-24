'use client';

import type { Page, Post } from '@instagram/shared';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { Clapperboard, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { usePost } from '@/features/posts/queries';
import { useSearchPosts, useTopReels } from '@/features/search/queries';
import { cn } from '@/lib/utils';
import { useReels } from '../queries';
import { ReelItem } from './reel-item';

type ReelsQuery = UseInfiniteQueryResult<InfiniteData<Page<Post>>>;

// The reel from /reel/:id, shown before the feed
function FirstReel({ id }: { id: string }) {
  const { data } = usePost(id);
  return data ? <ReelItem reel={data} showTitle /> : null;
}

// REELS-2: one reel per screen, scrolling snaps from one to the next; arrow keys work too.
// `firstId` puts a reel from outside the list on top; `startId` opens the list at one of its reels.
function ReelsFeed({
  query,
  firstId,
  startId,
  fullScreen = false,
}: {
  query: ReelsQuery;
  firstId?: string;
  startId?: string;
  /** Over the whole screen (the Top viewer), also on a phone where the bottom bar is covered */
  fullScreen?: boolean;
}) {
  const t = useTranslations('reels');
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledToStart = useRef(false);
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const { ref, inView } = useInView({ rootMargin: '200% 0px' });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const box = scrollRef.current;
      const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea');
      if (!box || typing) return;
      if (event.key === 'ArrowDown') box.scrollBy({ top: box.clientHeight, behavior: 'smooth' });
      if (event.key === 'ArrowUp') box.scrollBy({ top: -box.clientHeight, behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Top also holds photo posts; the player only shows reels
  const reels = (data?.pages.flatMap((page) => page.items) ?? []).filter(
    (r) => r.id !== firstId && r.type === 'REEL',
  );

  // Jump to the chosen reel before the first paint, so the reels above it never start playing
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!startId || !box || scrolledToStart.current || reels.length === 0) return;
    const target = box.querySelector<HTMLElement>(`[data-reel-id="${startId}"]`);
    if (target) box.scrollTop = target.offsetTop;
    scrolledToStart.current = true;
  }, [startId, reels.length]);

  let content: React.ReactNode;
  if (isPending && !firstId) {
    content = (
      <div className="grid h-full place-items-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  } else if (error) {
    content = (
      <p className="grid h-full place-items-center text-sm text-muted-foreground">{t('error')}</p>
    );
  } else if (reels.length === 0 && !firstId) {
    content = (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <span className="grid size-15.5 place-items-center rounded-full border-2 border-foreground">
          <Clapperboard className="size-8" strokeWidth={1.5} />
        </span>
        <p className="font-semibold">{t('empty')}</p>
      </div>
    );
  } else {
    content = (
      <>
        {firstId && <FirstReel id={firstId} />}
        {reels.map((reel) => (
          <ReelItem key={reel.id} reel={reel} showTitle={!fullScreen} />
        ))}
        <div ref={ref} className="h-px" />
      </>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        'relative h-dvh snap-y snap-mandatory overflow-x-hidden overflow-y-auto scrollbar-none',
        // Phone: from the very top (the top bar hides on Reels) down to the bottom bar, black
        // behind the video. Full screen covers the bottom bar, so the item clears the iPhone's
        // home indicator itself (--reel-safe).
        'max-md:bg-black',
        fullScreen
          ? 'max-md:[--reel-safe:env(safe-area-inset-bottom)]'
          : 'max-md:-mt-15 max-md:h-[calc(100dvh-3.125rem-env(safe-area-inset-bottom))] max-md:[--reel-safe:0px]',
      )}
    >
      {content}
    </div>
  );
}

/** /reels and /reel/:id: every reel the viewer may see */
export function AllReels({ firstId }: { firstId?: string }) {
  return <ReelsFeed query={useReels()} firstId={firstId} />;
}

/** Only the Top reels, opened at the one clicked on the search page */
export function TopReelsFeed({ startId, fullScreen }: { startId: string; fullScreen?: boolean }) {
  return <ReelsFeed query={useTopReels()} startId={startId} fullScreen={fullScreen} />;
}

/** Reels found by a search, opened at the one clicked */
export function SearchReelsFeed({
  q,
  startId,
  fullScreen,
}: {
  q: string;
  startId: string;
  fullScreen?: boolean;
}) {
  return <ReelsFeed query={useSearchPosts(q, 'REEL')} startId={startId} fullScreen={fullScreen} />;
}
