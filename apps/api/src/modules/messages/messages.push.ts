import type { Language, MediaType, MessageType, PushPayload } from '@instagram/shared';

/** Data for a "new message" push; texts are built in the recipient's language. */
export type MessagePushInput = {
  conversationId: string;
  /** Group title; null for 1:1 chats and untitled groups */
  groupTitle: string | null;
  senderUsername: string;
  senderAvatarUrl: string | null;
  type: MessageType;
  text: string | null;
  mediaType: MediaType | null;
};

const PREVIEW_MAX = 100;

const truncate = (text: string) =>
  text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text;

type Texts = {
  text: (user: string, text: string) => string;
  photo: (user: string) => string;
  video: (user: string) => string;
  post: (user: string) => string;
  storyReply: (user: string, text: string) => string;
  voice: (user: string) => string;
  message: (user: string) => string;
};

export const messagePushTexts: Record<Language, Texts> = {
  EN: {
    text: (user, text) => `${user}: ${text}`,
    photo: (user) => `${user} sent a photo`,
    video: (user) => `${user} sent a video`,
    post: (user) => `${user} sent a post`,
    storyReply: (user, text) => `${user} replied to your story: ${text}`,
    voice: (user) => `${user} sent a voice message`,
    message: (user) => `${user} sent a message`,
  },
  RU: {
    text: (user, text) => `${user}: ${text}`,
    photo: (user) => `${user} отправил(а) фото`,
    video: (user) => `${user} отправил(а) видео`,
    post: (user) => `${user} отправил(а) публикацию`,
    storyReply: (user, text) => `${user} ответил(а) на вашу историю: ${text}`,
    voice: (user) => `${user} отправил(а) голосовое сообщение`,
    message: (user) => `${user} отправил(а) сообщение`,
  },
};

/** "maria reacted ❤️ to your message: hello" — to the author of the message */
export type ReactionPushInput = {
  conversationId: string;
  actorUsername: string;
  actorAvatarUrl: string | null;
  emoji: string;
  messageText: string | null;
};

const reactionTexts: Record<
  Language,
  (user: string, emoji: string, text: string | null) => string
> = {
  EN: (user, emoji, text) => `${user} reacted ${emoji} to your message${text ? `: ${text}` : ''}`,
  RU: (user, emoji, text) =>
    `${user} отреагировал(а) ${emoji} на ваше сообщение${text ? `: ${text}` : ''}`,
};

export function buildReactionPush(language: Language, input: ReactionPushInput): PushPayload {
  return {
    type: 'MESSAGE',
    title: input.actorUsername,
    body: reactionTexts[language](
      input.actorUsername,
      input.emoji,
      input.messageText ? truncate(input.messageText) : null,
    ),
    icon: input.actorAvatarUrl,
    url: `/direct/t/${input.conversationId}`,
    tag: `conversation:${input.conversationId}`,
  };
}

export function buildMessagePush(language: Language, input: MessagePushInput): PushPayload {
  const t = messagePushTexts[language];
  const user = input.senderUsername;
  const text = input.text ? truncate(input.text) : null;

  let body: string;
  if (input.type === 'TEXT' && text) body = t.text(user, text);
  else if (input.type === 'MEDIA')
    body = input.mediaType === 'VIDEO' ? t.video(user) : t.photo(user);
  else if (input.type === 'VOICE') body = t.voice(user);
  else if (input.type === 'POST_SHARE') body = t.post(user);
  else if (input.type === 'STORY_REPLY' && text) body = t.storyReply(user, text);
  else body = t.message(user);

  return {
    type: 'MESSAGE',
    title: input.groupTitle ?? user,
    body,
    icon: input.senderAvatarUrl,
    url: `/direct/t/${input.conversationId}`,
    tag: `conversation:${input.conversationId}`,
  };
}
