import type { Language, NotificationType } from '@instagram/shared';

/**
 * Localized web push texts (docs/spec/i18n.md#push-уведомления).
 * Push is shown by the browser without our frontend, so the backend builds the text
 * in the recipient's language. Message and call texts live in the messages / calls modules.
 */
type TemplateParams = {
  /** Actor username */
  actor: string;
  /** Comment text for comment-based notifications */
  text?: string;
};

type Template = (p: TemplateParams) => string;

/** REEL_LIKE = POST_LIKE on a post of type REEL ("liked your reel."). */
export type NotificationPushKey = NotificationType | 'REEL_LIKE';

export const pushMessages: Record<
  Language,
  { title: string } & Record<NotificationPushKey, Template>
> = {
  EN: {
    title: 'Instagram',
    POST_LIKE: ({ actor }) => `${actor} liked your post.`,
    REEL_LIKE: ({ actor }) => `${actor} liked your reel.`,
    COMMENT: ({ actor, text }) => `${actor} commented: ${text ?? ''}`,
    COMMENT_REPLY: ({ actor, text }) => `${actor} replied to your comment: ${text ?? ''}`,
    COMMENT_LIKE: ({ actor, text }) => `${actor} liked your comment: ${text ?? ''}`,
    FOLLOW: ({ actor }) => `${actor} started following you.`,
    FOLLOW_REQUEST: ({ actor }) => `${actor} requested to follow you.`,
    FOLLOW_ACCEPTED: ({ actor }) => `${actor} accepted your follow request.`,
    MENTION: ({ actor, text }) => `${actor} mentioned you in a comment: ${text ?? ''}`,
    POST_TAG: ({ actor }) => `${actor} tagged you in a post.`,
    STORY_LIKE: ({ actor }) => `${actor} liked your story.`,
  },
  RU: {
    title: 'Instagram',
    POST_LIKE: ({ actor }) => `${actor} нравится ваша публикация.`,
    REEL_LIKE: ({ actor }) => `${actor} нравится ваше видео Reels.`,
    COMMENT: ({ actor, text }) => `${actor} оставил(-а) комментарий: ${text ?? ''}`,
    COMMENT_REPLY: ({ actor, text }) => `${actor} ответил(-а) на ваш комментарий: ${text ?? ''}`,
    COMMENT_LIKE: ({ actor, text }) => `${actor} нравится ваш комментарий: ${text ?? ''}`,
    FOLLOW: ({ actor }) => `${actor} подписался(-ась) на вас.`,
    FOLLOW_REQUEST: ({ actor }) => `${actor} хочет подписаться на вас.`,
    FOLLOW_ACCEPTED: ({ actor }) => `${actor} принял(-а) ваш запрос на подписку.`,
    MENTION: ({ actor, text }) => `${actor} упомянул(-а) вас в комментарии: ${text ?? ''}`,
    POST_TAG: ({ actor }) => `${actor} отметил(-а) вас на публикации.`,
    STORY_LIKE: ({ actor }) => `${actor} нравится ваша история.`,
  },
};

const TEXT_MAX = 100;

/** Keeps the payload well under the 4 KB web push limit. */
export function truncate(text: string, max = TEXT_MAX): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
