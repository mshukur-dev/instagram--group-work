'use client';

import { Clapperboard, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { usePost } from '@/features/posts/queries';
import { useReels } from '../queries';
import { ReelItem } from './reel-item';

// The reel from /reel/:id, shown before the feed
function FirstReel({ id }: { id: string }) {
  const { data } = usePost(id);
  return data ? <ReelItem reel={data} /> : null;
}

// REELS-2: one reel per screen, scrolling snaps from one to the next; arrow keys work too.
// /reel/:id starts with that reel, then the usual feed.
export function ReelsFeed({ firstId }: { firstId?: string }) {
  const t = useTranslations('reels');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useReels();
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

  const reels = (data?.pages.flatMap((page) => page.items) ?? []).filter((r) => r.id !== firstId);

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
          <ReelItem key={reel.id} reel={reel} />
        ))}
        <div ref={ref} className="h-px" />
      </>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="h-dvh snap-y snap-mandatory overflow-x-hidden overflow-y-auto scrollbar-none max-md:h-[calc(100dvh-6.875rem)]"
    >
      {content}
    </div>
  );
}
