'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { CAPTION_MAX, type Place } from '@instagram/shared';
import { UserAvatar } from '@/components/user-avatar';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import type { DraftMedia } from '../draft';
import { LocationPicker } from './location-picker';

type Props = {
  items: DraftMedia[];
  aspect: number;
  caption: string;
  onCaption: (value: string) => void;
  location: Place | null;
  onLocation: (place: Place | null) => void;
};

// Shows the photo exactly as it will be cropped, using the crop area in percent:
// the full image is scaled up and shifted inside a box with the crop's aspect ratio.
function CroppedPreview({ item, aspect }: { item: DraftMedia; aspect: number }) {
  const area = item.areaPercent;
  if (item.type === 'VIDEO') {
    return (
      <video src={item.url} className="size-full object-cover" autoPlay muted loop playsInline />
    );
  }
  if (!area) return <img src={item.url} alt="" className="size-full object-cover" />;
  return (
    <img
      src={item.url}
      alt=""
      draggable={false}
      className="absolute max-w-none"
      style={{
        width: `${10000 / area.width}%`,
        left: `${-(area.x / area.width) * 100}%`,
        top: `${-(area.y / area.height) * 100}%`,
        aspectRatio: item.width / item.height,
      }}
      data-aspect={aspect}
    />
  );
}

export function DetailsStep({ items, aspect, caption, onCaption, location, onLocation }: Props) {
  const t = useTranslations('createPost');
  const format = useFormatter();
  const { data: me } = useMe();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const current = items[Math.min(index, items.length - 1)] ?? items[0];
  if (!current) return null;

  const left = caption.length > CAPTION_MAX - 100;

  return (
    <div className="flex size-full max-md:flex-col">
      {/* Preview: a box with the crop's aspect ratio that fits the available space */}
      <div className="bg-muted relative min-h-0 min-w-0 flex-1 @container-size">
        <div className="absolute inset-0 grid place-items-center">
          <div
            className="relative overflow-hidden"
            style={{ width: `min(100cqw, calc(100cqh * ${aspect}))`, aspectRatio: aspect }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.25 }}
                className="absolute inset-0"
              >
                <CroppedPreview item={current} aspect={aspect} />
              </motion.div>
            </AnimatePresence>

            {items.length > 1 && (
              <>
                {index > 0 && (
                  <button
                    type="button"
                    aria-label={t('previous')}
                    onClick={() => setIndex(index - 1)}
                    className="bg-background/80 absolute top-1/2 left-2 grid size-7 -translate-y-1/2 place-items-center rounded-full shadow-sm outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                )}
                {index < items.length - 1 && (
                  <button
                    type="button"
                    aria-label={t('next')}
                    onClick={() => setIndex(index + 1)}
                    className="bg-background/80 absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full shadow-sm outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                )}
                <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1">
                  {items.map((item, i) => (
                    <span
                      key={item.id}
                      className={cn(
                        'size-1.5 rounded-full transition-colors duration-200',
                        i === index ? 'bg-white' : 'bg-white/50',
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Caption */}
      <div className="border-border/50 flex w-85 shrink-0 flex-col border-l max-md:w-full max-md:border-t max-md:border-l-0">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <UserAvatar src={me?.avatarUrl ?? null} alt="" size={28} />
          <span className="text-sm font-semibold">{me?.username}</span>
        </div>
        <label htmlFor="post-caption" className="sr-only">
          {t('captionLabel')}
        </label>
        <textarea
          id="post-caption"
          value={caption}
          onChange={(event) => onCaption(event.target.value.slice(0, CAPTION_MAX))}
          placeholder={t('captionPlaceholder')}
          autoFocus
          className="placeholder:text-muted-foreground min-h-32 flex-1 resize-none bg-transparent px-4 text-base outline-none md:text-[15px]"
        />
        <div
          className={cn(
            'text-muted-foreground px-4 py-3 text-right text-xs tabular-nums transition-colors',
            left && 'text-destructive',
          )}
        >
          {format.number(caption.length)}/{format.number(CAPTION_MAX)}
        </div>
        <LocationPicker value={location} onChange={onLocation} />
      </div>
    </div>
  );
}
