'use client';

import type { Notification, UserPreview, ViewerFollowStatus } from '@instagram/shared';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { storyRing } from '@/components/story-avatar';
import { UserAvatar } from '@/components/user-avatar';
import { PostLink } from '@/features/posts/components/post-link';
import { FollowAction } from '@/features/profile/components/follow-button';
import { useFollowUser } from '@/features/profile/queries';
import { cldUrl } from '@/lib/cloudinary';
import { shortTimeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';

/** One row: a notification, or several likes of the same thing ("anna, max and 3 others") */
export type NotificationGroup = {
  key: string;
  notification: Notification;
  actors: UserPreview[];
};

function FollowBack({ notification }: { notification: Notification }) {
  const follow = useFollowUser();
  // The button answers at once; the server result replaces the guess
  const [status, setStatus] = useState<ViewerFollowStatus>(notification.actorFollowStatus);

  const onChange = (next: boolean) => {
    const previous = status;
    setStatus(next ? 'ACCEPTED' : 'NONE');
    follow.mutate(
      { username: notification.actor.username, follow: next },
      { onSuccess: (saved) => setStatus(saved), onError: () => setStatus(previous) },
    );
  };

  return (
    <FollowAction
      username={notification.actor.username}
      avatarUrl={notification.actor.avatarUrl}
      status={status}
      followsMe
      onChange={onChange}
      confirmUnfollow={false}
      className="shrink-0"
    />
  );
}

export function NotificationRow({
  group,
  onNavigate,
}: {
  group: NotificationGroup;
  onNavigate?: () => void;
}) {
  const t = useTranslations('notifications');
  const tTime = useTranslations('time');
  const { notification, actors } = group;
  // The row's own notification is always the newest person
  const first = notification.actor;
  const second = actors[1];
  const time = shortTimeAgo(notification.createdAt);
  const thumbnail = notification.post?.thumbnailUrl;

  const name = (user: UserPreview | undefined) =>
    function NameLink(chunks: React.ReactNode) {
      return (
        <Link
          href={`/${user?.username}`}
          onClick={onNavigate}
          className="font-semibold outline-none hover:opacity-70 focus-visible:underline"
        >
          {chunks}
        </Link>
      );
    };

  return (
    <li
      className={cn(
        'flex items-center gap-3 px-6 py-2 max-md:px-4',
        !notification.isRead && 'bg-brand/5',
      )}
    >
      {/* Several people: two avatars overlapping, like Instagram */}
      <Link href={`/${first.username}`} onClick={onNavigate} className="relative size-11 shrink-0">
        {second ? (
          <>
            <UserAvatar
              src={second.avatarUrl}
              alt=""
              size={32}
              className="absolute top-0 right-0"
            />
            <UserAvatar
              src={first.avatarUrl}
              alt={first.username}
              size={32}
              className="absolute bottom-0 left-0 rounded-full ring-2 ring-background"
            />
          </>
        ) : (
          // 44px with or without a story ring (the ring adds 4px a side)
          <UserAvatar
            src={first.avatarUrl}
            alt={first.username}
            size={storyRing(first) === 'none' ? 44 : 36}
            ring={storyRing(first)}
          />
        )}
      </Link>

      <p className="line-clamp-3 min-w-0 flex-1 text-sm wrap-break-word">
        {t.rich('actors', {
          count: actors.length,
          first: first.username,
          second: second?.username ?? '',
          others: actors.length - 2,
          a: name(first),
          b: name(second),
        })}{' '}
        {t(`text.${notification.type}`, {
          count: actors.length,
          kind: notification.post?.type ?? 'POST',
          text: notification.comment?.text ?? '',
        })}{' '}
        <span className="text-muted-foreground">{tTime(time.unit, { count: time.count })}</span>
      </p>

      {notification.type === 'FOLLOW' ? (
        <FollowBack notification={notification} />
      ) : notification.type === 'LIVE_STARTED' ? (
        // The live may be over by now: its page then says so
        <Link
          href={`/live/${first.username}`}
          onClick={onNavigate}
          className="shrink-0 rounded-lg bg-live px-4 py-1.5 text-sm font-semibold text-white outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('watchLive')}
        </Link>
      ) : (
        notification.post && (
          <PostLink
            postId={notification.post.id}
            onClick={onNavigate}
            className="size-11 shrink-0 overflow-hidden rounded-md bg-muted"
          >
            {thumbnail && (
              <img
                src={cldUrl(thumbnail, 'c_fill,w_88,h_88,f_auto,q_auto')}
                alt=""
                className="size-full object-cover"
              />
            )}
          </PostLink>
        )
      )}
    </li>
  );
}
