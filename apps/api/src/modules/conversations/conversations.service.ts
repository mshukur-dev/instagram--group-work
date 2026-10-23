import { Injectable } from '@nestjs/common';
import {
  type AddMembersInput,
  type Conversation,
  type ConversationPreview,
  type Count,
  type CreateGroupInput,
  ErrorCode,
  GROUP_MEMBERS_MAX,
  type Page,
  type PageQuery,
  ServerEvent,
  type UpdateConversationInput,
} from '@instagram/shared';
import { badRequest, forbidden, notFound } from '../../common/errors/app-exception';
import { cursorArgs, toPage } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowsService } from '../follows/follows.service';
import { MembersService, type Membership } from '../messages/members.service';
import { MessagesService } from '../messages/messages.service';
import { RealtimeService } from '../realtime/realtime.service';
import { UserPreviewService } from '../users/user-preview.service';
import {
  type ConversationRow,
  conversationInclude,
  toConversation,
  toConversationPreview,
} from './conversations.mapper';

const key = (conversationId: string, userId: string) => `${conversationId}:${userId}`;
const unique = (ids: string[]) => [...new Set(ids)];

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
    private readonly messages: MessagesService,
    private readonly follows: FollowsService,
    private readonly userPreview: UserPreviewService,
    private readonly realtime: RealtimeService,
  ) {}

  // ───────────── read ─────────────

  /**
   * My chats, most recent first. Empty 1:1 chats (opened but never written to)
   * are hidden until the first message, like in Instagram; so is a chat I deleted,
   * until something new is written in it.
   */
  async list(viewerId: string, query: PageQuery): Promise<Page<ConversationPreview>> {
    const rows = await this.prisma.conversation.findMany({
      where: {
        members: { some: { userId: viewerId, leftAt: null } },
        OR: [{ isGroup: true }, { messages: { some: {} } }],
      },
      include: conversationInclude,
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query),
    });
    const page = toPage(rows, query.limit, (row) => row);
    const visible = page.items.filter((row) => {
      const clearedAt = row.members.find((m) => m.userId === viewerId)?.clearedAt;
      return !clearedAt || row.lastMessageAt > clearedAt;
    });
    const items = await this.toPreviews(viewerId, visible);
    return { items, nextCursor: page.nextCursor };
  }

  async get(viewerId: string, conversationId: string): Promise<Conversation> {
    await this.members.requireMember(viewerId, conversationId);
    const row = await this.findRow(conversationId);
    const [users, unread] = await Promise.all([
      this.userPreview.build(
        viewerId,
        row.members.map((m) => m.user),
      ),
      this.unreadCounts([viewerId], [conversationId]),
    ]);
    return toConversation(viewerId, row, users, unread.get(key(conversationId, viewerId)) ?? 0);
  }

  /** Number of chats with unread messages (sidebar badge, DM-11). */
  async unreadCount(viewerId: string): Promise<Count> {
    const rows = await this.prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM conversation_members m
      WHERE m."userId" = ${viewerId}
        AND m."leftAt" IS NULL
        AND EXISTS (
          SELECT 1 FROM messages msg
          WHERE msg."conversationId" = m."conversationId"
            AND msg."senderId" <> ${viewerId}
            AND msg."createdAt" > m."lastReadAt"
        )`;
    return { count: Number(rows[0]?.count ?? 0) };
  }

  /** Preview of one conversation as each active member sees it (title, unread count…). */
  async previewsForMembers(conversationId: string): Promise<Map<string, ConversationPreview>> {
    const row = await this.findRow(conversationId);
    const memberIds = row.members.map((m) => m.userId);
    const unread = await this.unreadCounts(memberIds, [conversationId]);
    const result = new Map<string, ConversationPreview>();
    await Promise.all(
      memberIds.map(async (memberId) => {
        const users = await this.userPreview.build(
          memberId,
          row.members.map((m) => m.user),
        );
        const count = unread.get(key(conversationId, memberId)) ?? 0;
        result.set(memberId, toConversationPreview(memberId, row, users, count));
      }),
    );
    return result;
  }

  // ───────────── 1:1 ─────────────

  async openDirect(viewerId: string, otherId: string): Promise<Conversation> {
    const conversationId = await this.findOrCreateDirect(viewerId, otherId);
    return this.get(viewerId, conversationId);
  }

  /**
   * Exactly one 1:1 conversation per pair (database.md §4). A new one can't be
   * created when the other user only accepts messages from people they follow.
   */
  async findOrCreateDirect(viewerId: string, otherId: string): Promise<string> {
    if (viewerId === otherId) {
      throw badRequest(ErrorCode.VALIDATION_FAILED, "You can't message yourself.");
    }
    const other = await this.prisma.user.findUnique({
      where: { id: otherId },
      select: { id: true, messagePermission: true },
    });
    if (!other || (await this.follows.isBlockedBetween(viewerId, otherId))) {
      throw notFound(ErrorCode.USER_NOT_FOUND, 'User not found.');
    }

    const existing = await this.findDirect(viewerId, otherId);
    if (existing) return existing;

    if (other.messagePermission === 'FOLLOWING') {
      const follow = await this.prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: otherId, followingId: viewerId } },
        select: { status: true },
      });
      if (follow?.status !== 'ACCEPTED') {
        throw forbidden(
          ErrorCode.MESSAGING_NOT_ALLOWED,
          "This account doesn't accept messages from you.",
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // serialize concurrent "Message" clicks for the same pair
      const pair = [viewerId, otherId].sort().join(':');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pair}))`;
      const again = await tx.conversation.findFirst({
        where: directWhere(viewerId, otherId),
        select: { id: true },
      });
      if (again) return again.id;
      const created = await tx.conversation.create({
        data: {
          isGroup: false,
          members: { create: [{ userId: viewerId }, { userId: otherId }] },
        },
        select: { id: true },
      });
      return created.id;
    });
  }

  // ───────────── groups ─────────────

  async createGroup(viewerId: string, dto: CreateGroupInput): Promise<Conversation> {
    const memberIds = unique(dto.memberIds).filter((id) => id !== viewerId);
    if (memberIds.length < 2) {
      throw badRequest(ErrorCode.VALIDATION_FAILED, 'A group needs at least 2 other people.');
    }
    if (memberIds.length + 1 > GROUP_MEMBERS_MAX) {
      throw badRequest(
        ErrorCode.GROUP_TOO_LARGE,
        `A group can have up to ${GROUP_MEMBERS_MAX} people.`,
      );
    }
    await this.assertCanAdd(viewerId, memberIds);

    const { conversationId, messageId } = await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          isGroup: true,
          title: dto.title ?? null,
          members: {
            create: [
              { userId: viewerId, role: 'ADMIN' },
              ...memberIds.map((userId) => ({ userId, role: 'MEMBER' as const })),
            ],
          },
        },
        select: { id: true },
      });
      const message = await this.messages.createSystem(tx, conversation.id, {
        action: 'GROUP_CREATED',
        actorId: viewerId,
        targetIds: memberIds,
        ...(dto.title ? { title: dto.title } : {}),
      });
      return { conversationId: conversation.id, messageId: message.id };
    });

    await this.afterChange(conversationId, [messageId]);
    return this.get(viewerId, conversationId);
  }

  /** Rename or change the avatar (admin only). Each change adds a system message. */
  async update(
    viewerId: string,
    conversationId: string,
    dto: UpdateConversationInput,
  ): Promise<Conversation> {
    const membership = await this.members.requireMember(viewerId, conversationId);
    this.assertGroupAdmin(membership);

    const current = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { title: true, avatarUrl: true },
    });
    const titleChanged = dto.title !== undefined && dto.title !== current.title;
    const avatarChanged = dto.avatarUrl !== undefined && dto.avatarUrl !== current.avatarUrl;
    if (!titleChanged && !avatarChanged) return this.get(viewerId, conversationId);

    const messageIds = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          ...(titleChanged ? { title: dto.title } : {}),
          ...(avatarChanged ? { avatarUrl: dto.avatarUrl } : {}),
          lastMessageAt: now,
        },
      });
      const ids: string[] = [];
      if (titleChanged && dto.title !== undefined) {
        const m = await this.messages.createSystem(
          tx,
          conversationId,
          { action: 'TITLE_CHANGED', actorId: viewerId, title: dto.title },
          now,
        );
        ids.push(m.id);
      }
      if (avatarChanged) {
        const m = await this.messages.createSystem(
          tx,
          conversationId,
          { action: 'AVATAR_CHANGED', actorId: viewerId },
          now,
        );
        ids.push(m.id);
      }
      return ids;
    });

    await this.afterChange(conversationId, messageIds);
    return this.get(viewerId, conversationId);
  }

  /** Admin adds people; former members come back with their history. */
  async addMembers(viewerId: string, conversationId: string, dto: AddMembersInput): Promise<void> {
    const membership = await this.members.requireMember(viewerId, conversationId);
    this.assertGroupAdmin(membership);

    const requested = unique(dto.userIds).filter((id) => id !== viewerId);
    const existing = await this.prisma.conversationMember.findMany({
      where: { conversationId, userId: { in: requested } },
      select: { userId: true, leftAt: true },
    });
    const activeIds = new Set(existing.filter((m) => !m.leftAt).map((m) => m.userId));
    const formerIds = new Set(existing.filter((m) => m.leftAt).map((m) => m.userId));
    const toAdd = requested.filter((id) => !activeIds.has(id));
    if (toAdd.length === 0) return;

    const activeCount = await this.prisma.conversationMember.count({
      where: { conversationId, leftAt: null },
    });
    if (activeCount + toAdd.length > GROUP_MEMBERS_MAX) {
      throw badRequest(
        ErrorCode.GROUP_TOO_LARGE,
        `A group can have up to ${GROUP_MEMBERS_MAX} people.`,
      );
    }
    await this.assertCanAdd(viewerId, toAdd);

    const messageId = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const rejoining = toAdd.filter((id) => formerIds.has(id));
      const fresh = toAdd.filter((id) => !formerIds.has(id));
      if (rejoining.length) {
        await tx.conversationMember.updateMany({
          where: { conversationId, userId: { in: rejoining } },
          data: { leftAt: null, role: 'MEMBER', joinedAt: now, lastReadAt: now },
        });
      }
      if (fresh.length) {
        await tx.conversationMember.createMany({
          data: fresh.map((userId) => ({ conversationId, userId, joinedAt: now, lastReadAt: now })),
        });
      }
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
      const m = await this.messages.createSystem(
        tx,
        conversationId,
        { action: 'MEMBER_ADDED', actorId: viewerId, targetIds: toAdd },
        now,
      );
      return m.id;
    });

    await this.afterChange(conversationId, [messageId]);
  }

  /** Admin removes someone, or a member removes themselves (= leaves the group). */
  async removeMember(viewerId: string, conversationId: string, userId: string): Promise<void> {
    const membership = await this.members.requireMember(viewerId, conversationId);
    if (!membership.isGroup) {
      throw badRequest(ErrorCode.NOT_A_GROUP, 'This is not a group chat.');
    }
    const leaving = userId === viewerId;
    if (!leaving) {
      this.assertGroupAdmin(membership);
      if (!(await this.members.isActiveMember(userId, conversationId))) {
        throw notFound(ErrorCode.NOT_A_MEMBER, "This person isn't in the group.");
      }
    }

    const messageId = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { leftAt: now, role: 'MEMBER' },
      });
      // a group always keeps an admin: promote the longest-standing member
      const adminLeft = await tx.conversationMember.count({
        where: { conversationId, leftAt: null, role: 'ADMIN' },
      });
      if (adminLeft === 0) {
        const next = await tx.conversationMember.findFirst({
          where: { conversationId, leftAt: null },
          orderBy: { joinedAt: 'asc' },
          select: { userId: true },
        });
        if (next) {
          await tx.conversationMember.update({
            where: { conversationId_userId: { conversationId, userId: next.userId } },
            data: { role: 'ADMIN' },
          });
        }
      }
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
      const m = await this.messages.createSystem(
        tx,
        conversationId,
        leaving
          ? { action: 'MEMBER_LEFT', actorId: viewerId }
          : { action: 'MEMBER_REMOVED', actorId: viewerId, targetIds: [userId] },
        now,
      );
      return m.id;
    });

    this.realtime.emitToUser(userId, ServerEvent.CONVERSATION_REMOVED, { conversationId });
    await this.afterChange(conversationId, [messageId]);
  }

  /**
   * "Delete chat", only for me: the chat leaves my inbox and its history is hidden from me;
   * the others keep theirs. A new message brings the chat back, empty before it. Deleting a
   * group chat also leaves the group.
   */
  async deleteForMe(viewerId: string, conversationId: string): Promise<void> {
    const membership = await this.members.requireMember(viewerId, conversationId);
    if (membership.isGroup) await this.removeMember(viewerId, conversationId, viewerId);
    const now = new Date();
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: viewerId } },
      data: { clearedAt: now, lastReadAt: now },
    });
    // my other tabs drop it too (leaving a group already sent this)
    if (!membership.isGroup) {
      this.realtime.emitToUser(viewerId, ServerEvent.CONVERSATION_REMOVED, { conversationId });
    }
  }

  /** "Seen": moves my lastReadAt and tells the other members. */
  async markRead(viewerId: string, conversationId: string): Promise<void> {
    await this.members.requireMember(viewerId, conversationId);
    const lastReadAt = new Date();
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: viewerId } },
      data: { lastReadAt },
    });
    const memberIds = await this.members.activeMemberIds(conversationId);
    this.realtime.emitToUsers(memberIds, ServerEvent.CONVERSATION_READ, {
      conversationId,
      userId: viewerId,
      lastReadAt: lastReadAt.toISOString(),
    });
  }

  /** conversation:updated to every active member, then message:new for system messages. */
  async emitUpdated(conversationId: string): Promise<void> {
    const previews = await this.previewsForMembers(conversationId);
    for (const [memberId, preview] of previews) {
      this.realtime.emitToUser(memberId, ServerEvent.CONVERSATION_UPDATED, preview);
    }
  }

  // ───────────── private ─────────────

  private async afterChange(conversationId: string, systemMessageIds: string[]): Promise<void> {
    await this.emitUpdated(conversationId);
    const memberIds = await this.members.activeMemberIds(conversationId);
    await this.messages.publish(systemMessageIds, memberIds);
  }

  private assertGroupAdmin(membership: Membership): void {
    if (!membership.isGroup) throw badRequest(ErrorCode.NOT_A_GROUP, 'This is not a group chat.');
    if (membership.role !== 'ADMIN') {
      throw forbidden(ErrorCode.NOT_GROUP_ADMIN, 'Only group admins can do this.');
    }
  }

  /** Every user exists and there is no block with the actor. */
  private async assertCanAdd(actorId: string, userIds: string[]): Promise<void> {
    const [found, blocked] = await Promise.all([
      this.prisma.user.count({ where: { id: { in: userIds } } }),
      this.follows.getBlockedUserIds(actorId),
    ]);
    const blockedSet = new Set(blocked);
    if (found !== userIds.length || userIds.some((id) => blockedSet.has(id))) {
      throw notFound(ErrorCode.USER_NOT_FOUND, 'User not found.');
    }
  }

  private async findDirect(a: string, b: string): Promise<string | null> {
    const row = await this.prisma.conversation.findFirst({
      where: directWhere(a, b),
      select: { id: true },
    });
    return row?.id ?? null;
  }

  private async findRow(conversationId: string): Promise<ConversationRow> {
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude,
    });
    if (!row) throw notFound(ErrorCode.CONVERSATION_NOT_FOUND, 'Conversation not found.');
    return row;
  }

  private async toPreviews(
    viewerId: string,
    rows: ConversationRow[],
  ): Promise<ConversationPreview[]> {
    if (rows.length === 0) return [];
    const [users, unread] = await Promise.all([
      this.userPreview.build(
        viewerId,
        rows.flatMap((r) => r.members.map((m) => m.user)),
      ),
      this.unreadCounts(
        [viewerId],
        rows.map((r) => r.id),
      ),
    ]);
    return rows.map((row) =>
      toConversationPreview(viewerId, row, users, unread.get(key(row.id, viewerId)) ?? 0),
    );
  }

  /** Unread messages per (conversation, member) in one query: from others, after lastReadAt. */
  private async unreadCounts(
    userIds: string[],
    conversationIds: string[],
  ): Promise<Map<string, number>> {
    if (userIds.length === 0 || conversationIds.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<
      { conversationId: string; userId: string; count: number }[]
    >`
      SELECT m."conversationId", m."userId", COUNT(msg.id)::int AS count
      FROM conversation_members m
      JOIN messages msg
        ON msg."conversationId" = m."conversationId"
       AND msg."senderId" <> m."userId"
       AND msg."createdAt" > m."lastReadAt"
      WHERE m."userId" = ANY(${userIds}) AND m."conversationId" = ANY(${conversationIds})
      GROUP BY m."conversationId", m."userId"`;
    return new Map(rows.map((r) => [key(r.conversationId, r.userId), Number(r.count)]));
  }
}

function directWhere(a: string, b: string) {
  return {
    isGroup: false,
    AND: [{ members: { some: { userId: a } } }, { members: { some: { userId: b } } }],
  };
}
