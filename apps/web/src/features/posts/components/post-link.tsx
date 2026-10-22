'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { openPostModal } from '../modal-store';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & {
  postId: string;
  /** Where the link leads when it is not opened as a modal (a new tab, a Reel) */
  href?: string;
  /** false: an ordinary link (Reels have a page of their own) */
  modal?: boolean;
};

// A link to a post. A plain click opens the post as a modal over the current page at once; a
// click with Ctrl / Cmd / Shift, a middle click, or a copied link opens /p/:id as a page.
export function PostLink({ postId, href, modal = true, onClick, ...props }: Props) {
  return (
    <Link
      {...props}
      href={href ?? `/p/${postId}`}
      onClick={(event) => {
        onClick?.(event);
        const plain =
          event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
        if (!modal || event.defaultPrevented || !plain) return;
        event.preventDefault();
        openPostModal(postId);
      }}
    />
  );
}
