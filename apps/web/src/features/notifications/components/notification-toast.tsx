'use client';

import type { Notification, NotificationType } from '@instagram/shared';
import { AtSign, Heart, MessageCircle, Radio, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { TOAST_CARD_FRAME, ToastCard } from '@/components/toast-card';
import { cldUrl } from '@/lib/cloudinary';

const DURATION_MS = 4500;
// A busy minute (many likes at once) shows one card, not a pile: the rest only add to the counter
const MIN_GAP_MS = 6000;
let lastShownAt = 0;

const icon = 'size-2.5';
const BADGES: Record<NotificationType, { badge: React.ReactNode; className: string }> = {
  POST_LIKE: { badge: <Heart className={`${icon} fill-current`} />, className: 'bg-like' },
  COMMENT_LIKE: { badge: <Heart className={`${icon} fill-current`} />, className: 'bg-like' },
  STORY_LIKE: { badge: <Heart className={`${icon} fill-current`} />, className: 'bg-like' },
  COMMENT: { badge: <MessageCircle className={`${icon} fill-current`} />, className: 'bg-brand' },
  COMMENT_REPLY: {
    badge: <MessageCircle className={`${icon} fill-current`} />,
    className: 'bg-brand',
  },
  MENTION: { badge: <AtSign className={icon} strokeWidth={3} />, className: 'bg-brand' },
  POST_TAG: { badge: <AtSign className={icon} strokeWidth={3} />, className: 'bg-brand' },
  FOLLOW: { badge: <UserPlus className={icon} strokeWidth={3} />, className: 'bg-brand' },
  FOLLOW_REQUEST: { badge: <UserPlus className={icon} strokeWidth={3} />, className: 'bg-brand' },
  FOLLOW_ACCEPTED: { badge: <UserPlus className={icon} strokeWidth={3} />, className: 'bg-brand' },
  LIVE_STARTED: { badge: <Radio className={icon} strokeWidth={3} />, className: 'bg-live' },
};

/** Where a tap on the card leads */
export function notificationHref(notification: Notification, myUsername: string): string {
  const { type, post, actor } = notification;
  if (type === 'LIVE_STARTED') return `/live/${actor.username}`;
  if (type === 'STORY_LIKE') return `/stories/${myUsername}`;
  if (type === 'FOLLOW_REQUEST') return '/notifications';
  if (post) return `/p/${post.id}`;
  return `/${actor.username}`;
}

type Options = {
  notification: Notification;
  /** The sentence after the name, already translated ("liked your post.") */
  text: string;
  onOpen: () => void;
};

// NOTIF-2: news while the site is open but the notifications aren't: a card with who and what
// (on a phone it drops from the top and is swiped away). The same thing again replaces its card.
export function showNotificationToast({ notification, text, onOpen }: Options) {
  const now = Date.now();
  if (now - lastShownAt < MIN_GAP_MS) return;
  lastShownAt = now;
  const { badge, className } = BADGES[notification.type];
  const thumbnail = notification.post?.thumbnailUrl;
  toast.custom(
    (id) => (
      <ToastCard
        avatarUrl={notification.actor.avatarUrl}
        badge={badge}
        badgeClassName={className}
        title={notification.actor.username}
        text={text}
        thumbnail={thumbnail ? cldUrl(thumbnail, 'c_fill,w_96,h_96,f_auto,q_auto') : null}
        onOpen={() => {
          toast.dismiss(id);
          onOpen();
        }}
        onClose={() => toast.dismiss(id)}
      />
    ),
    {
      id: `n:${notification.type}:${notification.post?.id ?? notification.actor.id}`,
      duration: DURATION_MS,
      className: TOAST_CARD_FRAME,
    },
  );
}
