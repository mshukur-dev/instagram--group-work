'use client';

import type { Highlight } from '@instagram/shared';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { HighlightViewer } from '@/features/stories/components/highlight-viewer';
import { useHighlights } from '@/features/stories/queries';
import { cldUrl } from '@/lib/cloudinary';
import { NewHighlightDialog } from './new-highlight-dialog';

// STORY-8: the profile's highlights between the header and the tabs: round covers with a thin
// gray ring and the title under each, scrolling sideways when there are many. A tap plays it.
// On my own profile the row ends with a "New" circle that creates one, like Instagram.
export function ProfileHighlights({
  username,
  avatarUrl,
  isMe,
}: {
  username: string;
  avatarUrl: string | null;
  isMe: boolean;
}) {
  const t = useTranslations('profile.highlights');
  const { data: highlights } = useHighlights(username);
  const [open, setOpen] = useState<Highlight | null>(null);
  const [creating, setCreating] = useState(false);

  if (!highlights || (!highlights.length && !isMe)) return null;

  return (
    <>
      <ul className="-mx-1 mb-11 flex gap-11 overflow-x-auto px-1 pb-1 scrollbar-none max-md:mb-4 max-md:gap-4 max-md:px-4">
        {highlights.map((h) => (
          <li key={h.id} className="shrink-0">
            <button
              type="button"
              onClick={() => setOpen(h)}
              className="group flex w-21.5 flex-col items-center gap-2 outline-none max-md:w-16"
            >
              <span className="rounded-full p-0.75 ring-1 ring-border transition-transform duration-150 group-active:scale-95 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <span className="block size-19.25 overflow-hidden rounded-full bg-muted max-md:size-14">
                  {(h.coverUrl ?? avatarUrl) && (
                    <img
                      src={cldUrl(
                        h.coverUrl ?? avatarUrl ?? '',
                        'c_fill,w_160,h_160,f_auto,q_auto',
                      )}
                      alt=""
                      draggable={false}
                      className="size-full object-cover"
                    />
                  )}
                </span>
              </span>
              <span className="w-full truncate text-center text-xs font-semibold">{h.title}</span>
            </button>
          </li>
        ))}
        {isMe && (
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="group flex w-21.5 flex-col items-center gap-2 outline-none max-md:w-16"
            >
              <span className="rounded-full p-0.75 ring-1 ring-border transition-transform duration-150 group-active:scale-95 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <span className="grid size-19.25 place-items-center rounded-full bg-secondary max-md:size-14">
                  <Plus className="size-11 text-muted-foreground max-md:size-8" strokeWidth={1} />
                </span>
              </span>
              <span className="w-full truncate text-center text-xs font-semibold">{t('new')}</span>
            </button>
          </li>
        )}
      </ul>
      {isMe && <NewHighlightDialog open={creating} onOpenChange={setCreating} />}
      <HighlightViewer
        highlight={open}
        owner={{ username, avatarUrl }}
        isMine={isMe}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
