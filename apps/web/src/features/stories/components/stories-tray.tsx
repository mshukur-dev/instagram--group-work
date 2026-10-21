'use client';

import Link from 'next/link';
import { UserAvatar } from '@/components/user-avatar';
import { useStoriesFeed } from '../queries';

// Rings above the feed: colored when there are unseen stories (FEED-3, STORY-4)
export function StoriesTray() {
  const { data: trays } = useStoriesFeed();

  if (!trays?.length) return null;

  return (
    <div className="mb-6 flex gap-4 overflow-x-auto px-1 py-2 [scrollbar-width:none]">
      {trays.map(({ user, hasUnseen }) => (
        <Link
          key={user.id}
          href={`/stories/${user.username}`}
          className="flex w-[66px] shrink-0 flex-col items-center gap-1"
        >
          <UserAvatar
            src={user.avatarUrl}
            alt={user.username}
            size={56}
            ring={hasUnseen ? 'unseen' : 'seen'}
          />
          <span className="w-full truncate text-center text-xs">{user.username}</span>
        </Link>
      ))}
    </div>
  );
}
