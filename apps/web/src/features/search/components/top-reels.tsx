'use client';

import { Clapperboard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useTopReels } from '../queries';
import { PostTile } from './post-tile';
import { TopReelViewer } from './top-reel-viewer';

const gridClass = 'grid grid-cols-3 gap-1';

// SEARCH-4 "Top": popular posts and reels in one grid, in the order the API lays them out (a tall
// reel and four posts per two rows). A post opens as usual; a reel plays right here, like Reels.
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
            <div key={i} className="aspect-square animate-pulse bg-muted" />
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
        // Three columns of squares; a reel is a tile two rows tall. Row height is a third of the
        // width (minus the gaps), so a row of reels alone keeps its size.
        <div className="@container">
          <div className="grid grid-flow-dense grid-cols-3 auto-rows-[calc((100cqw-0.5rem)/3)] gap-1">
            {reels.map((post) =>
              post.type === 'REEL' ? (
                <PostTile
                  key={post.id}
                  post={post}
                  tall
                  cell
                  href={`/explore/top/${post.id}`}
                  onOpen={() => setOpenId(post.id)}
                />
              ) : (
                <PostTile key={post.id} post={post} cell />
              ),
            )}
          </div>
        </div>
      )}
      <div ref={ref} />
      {openId && <TopReelViewer startId={openId} onClose={close} />}
    </section>
  );
}
