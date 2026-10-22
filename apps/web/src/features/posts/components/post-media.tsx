'use client';

import type { PostMedia as PostMediaItem } from '@instagram/shared';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { cldUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';

// Dark glass on the photo, so the arrows read on any picture and in both themes. They fade in and
// slide out from the edge when the pointer enters the post; they stay mounted (even at the ends of
// the carousel) so every change is a transition, not a pop.
const arrowBase =
  'absolute top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white outline-none backdrop-blur-md max-md:hidden ' +
  'transition-[opacity,scale,translate,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ' +
  'focus-visible:ring-2 focus-visible:ring-white/70';
const arrowShown =
  'scale-90 opacity-0 hover:bg-black/60 group-hover:scale-100 group-hover:opacity-100 focus-visible:scale-100 focus-visible:opacity-100';
const arrowHidden = 'pointer-events-none scale-90 opacity-0';

// Pagination dot by distance from the current slide: size in px and opacity
const DOT_LEVELS = [
  { size: 8, opacity: 1 },
  { size: 6, opacity: 0.7 },
  { size: 5, opacity: 0.5 },
  { size: 4, opacity: 0.35 },
  { size: 3, opacity: 0.25 },
] as const;

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
      <div
        ref={viewport}
        className={cn('size-full overflow-hidden', many && 'cursor-grab active:cursor-grabbing')}
      >
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

      {many && (
        <>
          <button
            type="button"
            aria-label={t('previous')}
            tabIndex={index > 0 ? 0 : -1}
            onClick={() => embla?.scrollPrev()}
            className={cn(
              arrowBase,
              'left-3',
              index > 0 ? arrowShown : arrowHidden,
              index > 0 && '-translate-x-1 group-hover:translate-x-0',
            )}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label={t('next')}
            tabIndex={index < media.length - 1 ? 0 : -1}
            onClick={() => embla?.scrollNext()}
            className={cn(
              arrowBase,
              'right-3',
              index < media.length - 1 ? arrowShown : arrowHidden,
              index < media.length - 1 && 'translate-x-1 group-hover:translate-x-0',
            )}
          >
            <ChevronRight className="size-4" />
          </button>

          {/* Position, like Instagram: 2/5 */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/45 px-2.5 py-1 text-xs leading-none font-medium text-white tabular-nums backdrop-blur-md"
          >
            {index + 1}/{media.length}
          </span>

          {/* Dots on a glass pill (readable on light and dark photos). The current dot is the
              largest; the farther a dot is from it, the smaller and fainter it gets. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <div className="flex h-5 items-center gap-1.5 rounded-full bg-black/35 px-2.5 backdrop-blur-md">
              {media.map((item, i) => {
                const level = DOT_LEVELS[Math.min(Math.abs(i - index), DOT_LEVELS.length - 1)];
                return (
                  <span
                    key={item.id}
                    style={{ width: level?.size, height: level?.size, opacity: level?.opacity }}
                    className="rounded-full bg-white transition-[width,height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                  />
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
