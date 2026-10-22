'use client';

import useEmblaCarousel from 'embla-carousel-react';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import { useStoriesFeed } from '../queries';

const FADE = '28px';

// Rings above the feed: colored when there are unseen stories (FEED-3, STORY-4).
// The row can be dragged or swiped with momentum; the edge that still has content fades out
// instead of cutting the avatars off. Nothing reacts to a plain hover.
export function StoriesTray() {
  const { data: trays } = useStoriesFeed();
  const [viewport, embla] = useEmblaCarousel({
    dragFree: true,
    containScroll: 'trimSnaps',
    align: 'start',
    duration: 28,
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    if (!embla) return;
    const update = () => {
      setCanPrev(embla.canScrollPrev());
      setCanNext(embla.canScrollNext());
    };
    update();
    embla.on('scroll', update).on('reInit', update).on('resize', update);
    return () => {
      embla.off('scroll', update).off('reInit', update).off('resize', update);
    };
  }, [embla, trays?.length]);

  if (!trays?.length) return null;

  const fade = {
    '--fade-start': canPrev ? FADE : '0px',
    '--fade-end': canNext ? FADE : '0px',
  } as CSSProperties;

  return (
    <div className="mb-6 max-md:mb-2 max-md:px-3">
      <div ref={viewport} style={fade} className="edge-fade -mx-2 overflow-hidden px-2 py-2">
        <div className="flex cursor-grab gap-4 active:cursor-grabbing">
          {trays.map(({ user, hasUnseen }) => (
            <Link
              key={user.id}
              href={`/stories/${user.username}`}
              draggable={false}
              className="group flex w-[82px] shrink-0 select-none flex-col items-center gap-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {/* Only a press reacts (a small squeeze), a hover does nothing */}
              <span className="transition-transform duration-150 ease-out group-active:scale-95 motion-reduce:transition-none">
                <UserAvatar
                  src={user.avatarUrl}
                  alt={user.username}
                  size={66}
                  ring={hasUnseen ? 'unseen' : 'seen'}
                  ringWidth="thick"
                />
              </span>
              <span
                className={cn(
                  'w-full truncate text-center text-xs',
                  hasUnseen ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {user.username}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
