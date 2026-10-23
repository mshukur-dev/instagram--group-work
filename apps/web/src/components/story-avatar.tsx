'use client';

import type { UserPreview } from '@instagram/shared';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { UserAvatar } from './user-avatar';

type StoryUser = Pick<UserPreview, 'username' | 'avatarUrl' | 'hasActiveStory' | 'hasUnseenStory'>;

export const storyRing = (user: StoryUser) =>
  user.hasUnseenStory ? 'unseen' : user.hasActiveStory ? 'seen' : 'none';

/**
 * An avatar with the story ring; with an active story, a click opens it over the page (the
 * viewer's intercepting route), and closing it comes back. Without a story it is a picture.
 */
export function StoryAvatar({
  user,
  size,
  ringWidth,
  className,
}: {
  user: StoryUser;
  size: number;
  ringWidth?: 'thin' | 'thick';
  className?: string;
}) {
  const t = useTranslations('stories');
  const avatar = (
    <UserAvatar
      src={user.avatarUrl}
      alt={user.username}
      size={size}
      ring={storyRing(user)}
      ringWidth={ringWidth}
      className={className}
    />
  );
  if (!user.hasActiveStory) return avatar;
  return (
    <Link
      href={`/stories/${user.username}`}
      aria-label={t('open', { username: user.username })}
      className="inline-flex shrink-0 rounded-full outline-none transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
    >
      {avatar}
    </Link>
  );
}

/**
 * For an avatar that sits inside another link (a chat row, a header): an invisible round link
 * laid over it that opens the story. Desktop only; on a phone the small target would fight the
 * row, so a tap there opens the row as before. Position it with `className`.
 */
export function StoryHotspot({ user, className }: { user: StoryUser; className?: string }) {
  const t = useTranslations('stories');
  if (!user.hasActiveStory) return null;
  return (
    <Link
      href={`/stories/${user.username}`}
      aria-label={t('open', { username: user.username })}
      className={cn(
        'absolute z-1 rounded-full outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring max-md:hidden',
        className,
      )}
    />
  );
}
