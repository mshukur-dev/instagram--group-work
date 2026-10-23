'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { CAPTION_MAX, type Place } from '@instagram/shared';
import { UserAvatar } from '@/components/user-avatar';
import { useMe } from '@/features/profile/queries';
import { cn } from '@/lib/utils';
import type { DraftMedia } from '../draft';
import { LocationPicker } from './location-picker';
import { PostPreview } from './post-preview';

type Props = {
  items: DraftMedia[];
  aspect: number;
  caption: string;
  onCaption: (value: string) => void;
  location: Place | null;
  onLocation: (place: Place | null) => void;
};

export function DetailsStep({ items, aspect, caption, onCaption, location, onLocation }: Props) {
  const t = useTranslations('createPost');
  const format = useFormatter();
  const { data: me } = useMe();
  const [index, setIndex] = useState(0);
  const current = items[Math.min(index, items.length - 1)] ?? items[0];
  if (!current) return null;

  const left = caption.length > CAPTION_MAX - 100;

  return (
    <div className="flex size-full max-md:flex-col">
      <PostPreview items={items} aspect={aspect} index={index} onIndex={setIndex} />

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
