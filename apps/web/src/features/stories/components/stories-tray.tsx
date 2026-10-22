'use client';

import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import { useStoriesFeed } from '../queries';

const FADE = '28px';

const arrowClass =
  'absolute top-[28px] z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white outline-none backdrop-blur-md max-md:hidden ' +
  'transition-[opacity,scale,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ' +
  'hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white/70';

// Rings above the feed: colored when there are unseen stories (FEED-3, STORY-4).
// The row can be dragged or swiped with momentum; the edge that still has content fades out
// instead of cutting the avatars off.
export function StoriesTray() {
  const t = useTranslations('stories');
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
    <div className="group/tray relative mb-6 max-md:mb-2 max-md:px-3">
      <div ref={viewport} style={fade} className="edge-fade -mx-2 overflow-hidden px-2 py-2">
        <div className="flex gap-4">
          {trays.map(({ user, hasUnseen }) => (
            <Link
              key={user.id}
              href={`/stories/${user.username}`}
              draggable={false}
              className="group flex w-[66px] shrink-0 select-none flex-col items-center gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <span className="transition-transform duration-200 ease-out group-hover:scale-[1.06] group-active:scale-95 motion-reduce:transition-none">
                <UserAvatar
                  src={user.avatarUrl}
                  alt={user.username}
                  size={54}
                  ring={hasUnseen ? 'unseen' : 'seen'}
                  ringWidth="thick"
                />
              </span>
              <span
                className={cn(
                  'w-full truncate text-center text-xs transition-colors',
                  hasUnseen ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {user.username}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <button
        type="button"
        aria-label={t('previous')}
        tabIndex={canPrev ? 0 : -1}
        onClick={() => embla?.scrollPrev()}
        className={cn(
          arrowClass,
          'left-1',
          canPrev
            ? 'scale-90 opacity-0 group-hover/tray:scale-100 group-hover/tray:opacity-100 focus-visible:scale-100 focus-visible:opacity-100'
            : 'pointer-events-none scale-90 opacity-0',
        )}
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label={t('next')}
        tabIndex={canNext ? 0 : -1}
        onClick={() => embla?.scrollNext()}
        className={cn(
          arrowClass,
          'right-1',
          canNext
            ? 'scale-90 opacity-0 group-hover/tray:scale-100 group-hover/tray:opacity-100 focus-visible:scale-100 focus-visible:opacity-100'
            : 'pointer-events-none scale-90 opacity-0',
        )}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
