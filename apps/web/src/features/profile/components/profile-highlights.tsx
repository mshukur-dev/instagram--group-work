'use client';

import type { Highlight } from '@instagram/shared';
import { useState } from 'react';
import { HighlightViewer } from '@/features/stories/components/highlight-viewer';
import { useHighlights } from '@/features/stories/queries';
import { cldUrl } from '@/lib/cloudinary';

// STORY-8: the profile's highlights between the header and the tabs: round covers with a thin
// gray ring and the title under each, scrolling sideways when there are many. A tap plays it.
export function ProfileHighlights({
  username,
  avatarUrl,
}: {
  username: string;
  avatarUrl: string | null;
}) {
  const { data: highlights } = useHighlights(username);
  const [open, setOpen] = useState<Highlight | null>(null);

  if (!highlights?.length) return null;

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
      </ul>
      <HighlightViewer
        highlight={open}
        owner={{ username, avatarUrl }}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
