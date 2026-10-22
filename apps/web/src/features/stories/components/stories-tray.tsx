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

  // Trackpad / shift+wheel: a horizontal scroll moves the row by one story (the row is moved by
  // transforms, so the browser has nothing to scroll natively)
  useEffect(() => {
    const node = embla?.rootNode();
    if (!embla || !node) return;
    let locked = false;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) < 8 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      if (locked) return;
      locked = true;
      window.setTimeout(() => (locked = false), 220);
      if (event.deltaX > 0) embla.scrollNext();
      else embla.scrollPrev();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [embla]);

  if (!trays?.length) return null;

  const fade = {
    '--fade-start': canPrev ? FADE : '0px',
    '--fade-end': canNext ? FADE : '0px',
  } as CSSProperties;

  return (
    <div className="mb-6 max-md:mb-2 max-md:px-3">
      <div ref={viewport} style={fade} className="edge-fade -mx-2 overflow-hidden px-2 py-2">
        <div className="flex cursor-grab touch-pan-y gap-1 active:cursor-grabbing">
          {trays.map(({ user, hasUnseen }) => (
            <Link
              key={user.id}
              href={`/stories/${user.username}`}
              draggable={false}
              className="group flex w-[90px] shrink-0 select-none flex-col items-center gap-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              {/* Only a press reacts (a small squeeze), a hover does nothing */}
              <span className="transition-transform duration-150 ease-out group-active:scale-95 motion-reduce:transition-none">
                <UserAvatar
                  src={user.avatarUrl}
                  alt={user.username}
                  size={74}
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
