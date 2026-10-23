import type { Prisma } from '@prisma/client';
import type {
  Message,
  MessagePreview,
  Post,
  Story,
  SystemMessageAction,
  SystemMessageData,
  UserPreview,
} from '@instagram/shared';
import { userPreviewSelect } from '../users/user-preview.service';
import { toCallSummary } from '../calls/calls.mapper';

/** Everything needed to build a Message DTO. */
export const messageInclude = {
  sender: { select: userPreviewSelect },
  replyTo: {
    select: {
      id: true,
      type: true,
      senderId: true,
      text: true,
      deletedAt: true,
      createdAt: true,
      sender: { select: { username: true } },
    },
  },
  reactions: { select: { emoji: true, userId: true }, orderBy: { createdAt: 'asc' } },
  call: { include: { _count: { select: { participants: true } } } },
} satisfies Prisma.MessageInclude;

export type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

/** Minimal columns for a MessagePreview (last message in the chat list, reply quote). */
export const messagePreviewSelect = {
  id: true,
  type: true,
  senderId: true,
  text: true,
  deletedAt: true,
  createdAt: true,
  sender: { select: { username: true } },
} satisfies Prisma.MessageSelect;

export type MessagePreviewRow = Prisma.MessageGetPayload<{ select: typeof messagePreviewSelect }>;

/** What is stored in Message.systemData (text is built on the frontend). */
export type StoredSystemData = {
  action: SystemMessageAction;
  actorId: string;
  targetIds: string[];
  title?: string;
};

export function parseSystemData(value: Prisma.JsonValue | null): StoredSystemData | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Partial<StoredSystemData>;
  if (typeof data.action !== 'string' || typeof data.actorId !== 'string') return null;
  return {
    action: data.action,
    actorId: data.actorId,
    targetIds: Array.isArray(data.targetIds)
      ? data.targetIds.filter((id) => typeof id === 'string')
      : [],
    ...(typeof data.title === 'string' ? { title: data.title } : {}),
  };
}

/** User ids referenced by system messages (actor + targets), to load their previews. */
export function systemUserIds(rows: { systemData: Prisma.JsonValue | null }[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    const data = parseSystemData(row.systemData);
    if (!data) continue;
    ids.add(data.actorId);
    data.targetIds.forEach((id) => ids.add(id));
  }
  return [...ids];
}

export function toMessagePreview(row: MessagePreviewRow): MessagePreview {
  const isDeleted = row.deletedAt !== null;
  return {
    id: row.id,
    type: row.type,
    senderId: row.senderId,
    senderUsername: row.sender.username,
    text: isDeleted ? null : row.text,
    isDeleted,
    createdAt: row.createdAt.toISOString(),
  };
}

export type MessageContext = {
  users: Map<string, UserPreview>;
  posts: Map<string, Post>;
  stories: Map<string, Story>;
  /** Echoed back only to the sender's request and the message:new event */
  clientId?: string | null;
};

const unknownUser = (id: string): UserPreview => ({
  id,
  username: '',
  fullName: '',
  avatarUrl: null,
  hasActiveStory: false,
  hasUnseenStory: false,
});

function toSystemData(row: MessageRow, users: Map<string, UserPreview>): SystemMessageData | null {
  const data = parseSystemData(row.systemData);
  if (!data) return null;
  return {
    action: data.action,
    actor: users.get(data.actorId) ?? unknownUser(data.actorId),
    // users who deleted their account are dropped
    targets: data.targetIds.flatMap((id) => {
      const user = users.get(id);
      return user ? [user] : [];
    }),
    ...(data.title !== undefined ? { title: data.title } : {}),
  };
}

export function toMessageDto(row: MessageRow, ctx: MessageContext): Message {
  const isDeleted = row.deletedAt !== null;
  return {
    id: row.id,
    conversationId: row.conversationId,
    clientId: ctx.clientId ?? null,
    sender: ctx.users.get(row.senderId) ?? unknownUser(row.senderId),
    type: row.type,
    text: isDeleted ? null : row.text,
    mediaUrl: isDeleted ? null : row.mediaUrl,
    mediaType: isDeleted ? null : row.mediaType,
    voice:
      !isDeleted && row.type === 'VOICE' && row.voiceDuration !== null
        ? { duration: row.voiceDuration, waveform: row.voiceWaveform }
        : null,
    post: !isDeleted && row.postId ? (ctx.posts.get(row.postId) ?? null) : null,
    story: !isDeleted && row.storyId ? (ctx.stories.get(row.storyId) ?? null) : null,
    call: row.call ? toCallSummary(row.call) : null,
    replyTo: !isDeleted && row.replyTo ? toMessagePreview(row.replyTo) : null,
    reactions: isDeleted ? [] : row.reactions,
    systemData: row.type === 'SYSTEM' ? toSystemData(row, ctx.users) : null,
    isDeleted,
    createdAt: row.createdAt.toISOString(),
  };
}
