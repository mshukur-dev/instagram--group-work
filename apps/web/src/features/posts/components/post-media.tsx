'use client';

import type { PostMedia as PostMediaItem } from '@instagram/shared';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { cldUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';

const arrowClass =
  'absolute top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground opacity-0 shadow-sm outline-none backdrop-blur-sm transition-[opacity,background-color] hover:bg-background focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 max-md:hidden';

// Only the slide on screen plays; the others are paused
function SlideVideo({ item, active }: { item: PostMediaItem; active: boolean }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (active) void element.play().catch(() => undefined);
    else element.pause();
  }, [active]);

  return (
    <video
      ref={video}
      src={cldUrl(item.url, 'f_auto,q_auto')}
      poster={item.thumbnailUrl ?? undefined}
      className="size-full object-cover"
      muted
      loop
      playsInline
      preload="metadata"
    />
  );
}

// Carousel of 1–10 photos/videos (POST-1): drag or swipe, arrows on hover. The aspect ratio
// comes from the first item, clamped like Instagram: from 4:5 (portrait) to 1.91:1 (landscape).
export function PostMedia({ media }: { media: PostMediaItem[] }) {
  const t = useTranslations('post');
  const [viewport, embla] = useEmblaCarousel({ duration: 22, containScroll: false });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on('select', onSelect);
    embla.on('reInit', onSelect);
    return () => {
      embla.off('select', onSelect);
      embla.off('reInit', onSelect);
    };
  }, [embla]);

  const first = media[0];
  if (!first) return null;
  const ratio = Math.min(Math.max(first.width / first.height, 4 / 5), 1.91);
  const many = media.length > 1;

  return (
    <div
      className="group bg-muted relative overflow-hidden rounded-xl max-md:rounded-none"
      style={{ aspectRatio: ratio }}
    >
      <div ref={viewport} className={cn('size-full overflow-hidden', many && 'cursor-grab active:cursor-grabbing')}>
        <div className="flex size-full touch-pan-y">
          {media.map((item, i) => (
            <div key={item.id} className="relative size-full min-w-0 flex-[0_0_100%]">
              {item.type === 'VIDEO' ? (
                <SlideVideo item={item} active={i === index} />
              ) : (
                <img
                  src={cldUrl(item.url, 'w_1080,f_auto,q_auto')}
                  alt=""
                  draggable={false}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className="size-full object-cover select-none"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {many && index > 0 && (
        <button
          type="button"
          aria-label={t('previous')}
          onClick={() => embla?.scrollPrev()}
          className={cn(arrowClass, 'left-3')}
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      {many && index < media.length - 1 && (
        <button
          type="button"
          aria-label={t('next')}
          onClick={() => embla?.scrollNext()}
          className={cn(arrowClass, 'right-3')}
        >
          <ChevronRight className="size-4" />
        </button>
      )}

      {many && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1">
          {media.map((item, i) => (
            <span
              key={item.id}
              className={cn(
                'h-1.5 rounded-full bg-white transition-[width,opacity] duration-300',
                i === index ? 'w-4 opacity-100' : 'w-1.5 opacity-50',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
