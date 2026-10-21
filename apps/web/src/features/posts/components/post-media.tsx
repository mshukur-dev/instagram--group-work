'use client';

import type { PostMedia as PostMediaItem } from '@instagram/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cldUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';

const arrowClass =
  'absolute top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm transition-colors hover:bg-background';

// Carousel of 1–10 photos/videos (POST-1). Aspect ratio comes from the first item,
// clamped like Instagram: from 4:5 (portrait) to 1.91:1 (landscape).
export function PostMedia({ media }: { media: PostMediaItem[] }) {
  const t = useTranslations('post');
  const [index, setIndex] = useState(0);

  const first = media[0];
  if (!first) return null;
  const current = media[index] ?? first;
  const ratio = Math.min(Math.max(first.width / first.height, 4 / 5), 1.91);

  return (
    <div
      className="relative overflow-hidden rounded-sm border bg-muted max-md:rounded-none max-md:border-x-0"
      style={{ aspectRatio: ratio }}
    >
      {current.type === 'VIDEO' ? (
        <video
          key={current.id}
          src={cldUrl(current.url, 'f_auto,q_auto')}
          poster={current.thumbnailUrl ?? undefined}
          className="size-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <img
          src={cldUrl(current.url, 'w_1080,f_auto,q_auto')}
          alt=""
          className="size-full object-cover"
        />
      )}

      {index > 0 && (
        <button
          type="button"
          aria-label={t('previous')}
          onClick={() => setIndex(index - 1)}
          className={cn(arrowClass, 'left-3')}
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      {index < media.length - 1 && (
        <button
          type="button"
          aria-label={t('next')}
          onClick={() => setIndex(index + 1)}
          className={cn(arrowClass, 'right-3')}
        >
          <ChevronRight className="size-4" />
        </button>
      )}

      {media.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1">
          {media.map((item, i) => (
            <span
              key={item.id}
              className={cn('size-1.5 rounded-full', i === index ? 'bg-white' : 'bg-white/50')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
