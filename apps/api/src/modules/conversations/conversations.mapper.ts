import type { Prisma } from '@prisma/client';
import type {
  Conversation,
  ConversationMember,
  ConversationPreview,
  UserPreview,
} from '@instagram/shared';
import { userPreviewSelect } from '../users/user-preview.service';
import { messagePreviewSelect, toMessagePreview } from '../messages/messages.mapper';

/** Everything needed to build ConversationPreview / Conversation. */
export const conversationInclude = {
  members: {
    where: { leftAt: null },
    include: { user: { select: userPreviewSelect } },
    orderBy: { joinedAt: 'asc' },
  },
  messages: {
    select: messagePreviewSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
  },
  calls: {
    where: { status: { in: ['RINGING', 'ACTIVE'] } },
    include: { participants: { where: { leftAt: null }, select: { userId: true } } },
    orderBy: { startedAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.ConversationInclude;

export type ConversationRow = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;

const AVATARS_MAX = 2;

export function toConversationPreview(
  viewerId: string,
  row: ConversationRow,
  users: Map<string, UserPreview>,
  unreadCount: number,
): ConversationPreview {
  const others = row.members.filter((m) => m.userId !== viewerId);
  const otherUsers = others.map((m) => users.get(m.userId) ?? fallbackPreview(m.user));
  const otherUser = row.isGroup ? null : (otherUsers[0] ?? null);
  const call = row.calls[0];
  // A chat I deleted shows no old last message
  const clearedAt = row.members.find((m) => m.userId === viewerId)?.clearedAt;
  const latest = row.messages[0];
  const lastMessage = latest && (!clearedAt || latest.createdAt > clearedAt) ? latest : undefined;

  let title: string;
  if (!row.isGroup) title = otherUser?.username ?? '';
  else title = row.title ?? otherUsers.map((u) => u.username).join(', ');

  const avatarUrls =
    row.isGroup && row.avatarUrl
      ? [row.avatarUrl]
      : otherUsers.flatMap((u) => (u.avatarUrl ? [u.avatarUrl] : [])).slice(0, AVATARS_MAX);

  return {
    id: row.id,
    isGroup: row.isGroup,
    title,
    avatarUrls,
    lastMessage: lastMessage ? toMessagePreview(lastMessage) : null,
    lastMessageAt: row.lastMessageAt.toISOString(),
    unreadCount,
    activeCall: call
      ? {
          id: call.id,
          type: call.type,
          status: call.status,
          participantIds: call.participants.map((p) => p.userId),
        }
      : null,
    otherUser,
  };
}

export function toConversation(
  viewerId: string,
  row: ConversationRow,
  users: Map<string, UserPreview>,
  unreadCount: number,
): Conversation {
  const members: ConversationMember[] = row.members.map((m) => ({
    ...(users.get(m.userId) ?? fallbackPreview(m.user)),
    role: m.role,
    lastReadAt: m.lastReadAt.toISOString(),
  }));
  const me = row.members.find((m) => m.userId === viewerId);
  return {
    ...toConversationPreview(viewerId, row, users, unreadCount),
    members,
    myRole: me?.role ?? 'MEMBER',
    createdAt: row.createdAt.toISOString(),
  };
}

function fallbackPreview(
  user: Prisma.UserGetPayload<{ select: typeof userPreviewSelect }>,
): UserPreview {
  return { ...user, hasActiveStory: false, hasUnseenStory: false };
}
