'use client';

import type { ConversationPreview } from '@instagram/shared';
import { storyRing } from '@/components/story-avatar';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import { usePresence } from '../realtime-store';

type Props = {
  conversation: Pick<ConversationPreview, 'isGroup' | 'title' | 'avatarUrls' | 'otherUser'>;
  size: number;
  /** Green dot when the other person of a 1:1 chat is online */
  showPresence?: boolean;
  className?: string;
};

// 1:1: the other person's avatar (with a story ring and the online dot). Group: two avatars
// overlapping diagonally, like Instagram, or the group photo when one is set.
export function ConversationAvatar({ conversation, size, showPresence, className }: Props) {
  const presence = usePresence(conversation.otherUser?.id);
  const [first, second] = conversation.avatarUrls;

  if (conversation.isGroup && conversation.avatarUrls.length > 1) {
    const small = Math.round(size * 0.72);
    return (
      <span
        className={cn('relative inline-block shrink-0', className)}
        style={{ width: size, height: size }}
      >
        <UserAvatar src={first ?? null} alt="" size={small} className="absolute top-0 left-0" />
        <UserAvatar
          src={second ?? null}
          alt=""
          size={small}
          className="absolute right-0 bottom-0 rounded-full ring-2 ring-background"
        />
      </span>
    );
  }

  const user = conversation.otherUser;
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <UserAvatar
        src={user?.avatarUrl ?? first ?? null}
        alt={conversation.title}
        size={size}
        ring={user ? storyRing(user) : 'none'}
      />
      {showPresence && presence?.isOnline && (
        <span
          aria-hidden="true"
          className="absolute right-0.5 bottom-0.5 size-3.5 rounded-full bg-emerald-500 ring-[3px] ring-background"
        />
      )}
    </span>
  );
}
