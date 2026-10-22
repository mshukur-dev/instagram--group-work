'use client';

import type { Post } from '@instagram/shared';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { UserListDialog } from '@/features/profile/components/follow-list-dialog';
import { likersOptions } from '../queries';
import { LikesCount } from './likes-count';

// "Liked by maria and 5 others", like Instagram: small stacked avatars of up to three likers
// (people I follow first), the first name links to the profile, "5 others" opens the list of
// everyone who liked it. Without someone to name (only I liked it): just "N likes", also a link.
export function LikedBy({ post }: { post: Post }) {
  const t = useTranslations('post');
  const [open, setOpen] = useState(false);
  const [first] = post.likedBy;
  // The named person counts as one of the likes; my own like is among the "others"
  const others = Math.max(0, post.likesCount - 1);

  if (post.likesCount <= 0) return null;

  const openList = (chunks: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="rounded-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {chunks}
    </button>
  );

  return (
    <>
      {first ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="flex shrink-0 -space-x-1.5">
            {post.likedBy.map((user) => (
              <UserAvatar
                key={user.id}
                src={user.avatarUrl}
                alt=""
                size={20}
                className="rounded-full ring-2 ring-card"
              />
            ))}
          </span>
          <p className="min-w-0 leading-5">
            {t.rich(others > 0 ? 'likedBy' : 'likedByOne', {
              count: others,
              user: () => (
                <Link href={`/${first.username}`} className="font-semibold">
                  {first.username}
                </Link>
              ),
              others: openList,
            })}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LikesCount count={post.likesCount} />
        </button>
      )}

      {open && (
        <UserListDialog
          title={t('likesTitle')}
          emptyText={t('noLikes')}
          list={(q) => likersOptions(post.id, q)}
          // The post may itself be open in a modal
          stacked
          open
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
