'use client';

import { Clapperboard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useTopReels } from '../queries';
import { PostTile } from './post-tile';
import { TopReelViewer } from './top-reel-viewer';

const gridClass = 'grid grid-cols-4 gap-1 max-md:grid-cols-3';

// SEARCH-4 "Top": a reel gets here once it has TOP_REEL_MIN_VIEWS views; most viewed first.
// A click plays it right here, like Reels, over the grid.
export function TopReels() {
  const t = useTranslations('search');
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useTopReels();
  const { ref, inView } = useInView({ rootMargin: '600px' });
  const [openId, setOpenId] = useState<string | null>(null);
  const close = useCallback(() => setOpenId(null), []);

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const reels = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="mt-6 max-md:mt-4">
      {isPending ? (
        <div className={gridClass}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-9/16 animate-pulse bg-muted" />
          ))}
        </div>
      ) : error ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{t('topError')}</p>
      ) : reels.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="grid size-15.5 place-items-center rounded-full border-2 border-foreground">
            <Clapperboard className="size-8" strokeWidth={1.5} />
          </span>
          <p className="font-semibold">{t('topEmpty')}</p>
        </div>
      ) : (
        <div className={gridClass}>
          {reels.map((reel) => (
            <PostTile
              key={reel.id}
              post={reel}
              tall
              href={`/explore/top/${reel.id}`}
              onOpen={() => setOpenId(reel.id)}
            />
          ))}
        </div>
      )}
      <div ref={ref} />
      {openId && <TopReelViewer startId={openId} onClose={close} />}
    </section>
  );
}
