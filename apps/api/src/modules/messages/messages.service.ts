import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ErrorCode,
  type Message,
  type Page,
  type PageQuery,
  type Post,
  type SendMessageInput,
  ServerEvent,
  type Story,
  type SystemMessageAction,
} from '@instagram/shared';
import { badRequest, forbidden, notFound } from '../../common/errors/app-exception';
import { cursorArgs, toPage } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowsService } from '../follows/follows.service';
import { PostsService } from '../posts/posts.service';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';
import { StoriesService } from '../stories/stories.service';
import { UserPreviewService, userPreviewSelect } from '../users/user-preview.service';
import { MembersService } from './members.service';
import {
  type MessageRow,
  type StoredSystemData,
  messageInclude,
  systemUserIds,
  toMessageDto,
} from './messages.mapper';
import { buildMessagePush } from './messages.push';

export type SystemMessageInput = {
  action: SystemMessageAction;
  actorId: string;
  targetIds?: string[];
  title?: string;
};

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
    private readonly follows: FollowsService,
    private readonly userPreview: UserPreviewService,
    private readonly posts: PostsService,
    private readonly stories: StoriesService,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
  ) {}

  /** Newest first. */
  async list(viewerId: string, conversationId: string, query: PageQuery): Promise<Page<Message>> {
    const { clearedAt } = await this.members.requireMember(viewerId, conversationId);
    const rows = await this.prisma.message.findMany({
      // after "Delete chat" only what came later is shown
      where: { conversationId, ...(clearedAt && { createdAt: { gt: clearedAt } }) },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query),
    });
    const page = toPage(rows, query.limit, (row) => row);
    const items = await this.toDtos(viewerId, page.items);
    return { items, nextCursor: page.nextCursor };
  }

  async send(senderId: string, conversationId: string, dto: SendMessageInput): Promise<Message> {
    const membership = await this.members.requireMember(senderId, conversationId);
    await this.members.assertNotBlocked(senderId, membership);
    await this.validateContent(senderId, conversationId, dto);

    const now = new Date();
    const [created] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          senderId,
          type: dto.type,
          text: dto.text ?? null,
          mediaUrl: dto.type === 'MEDIA' ? (dto.mediaUrl ?? null) : null,
          mediaType: dto.type === 'MEDIA' ? (dto.mediaType ?? null) : null,
          postId: dto.type === 'POST_SHARE' ? (dto.postId ?? null) : null,
          storyId: dto.type === 'STORY_REPLY' ? (dto.storyId ?? null) : null,
          replyToId: dto.replyToId ?? null,
          createdAt: now,
        },
        include: messageInclude,
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      }),
      // sending a message means the sender has read the chat
      this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: senderId } },
        data: { lastReadAt: now },
      }),
    ]);

    const clientId = dto.clientId ?? null;
    const [message] = await this.toDtos(senderId, [created], clientId);
    if (!message) throw new Error('Message mapping failed');

    // side effects after the write
    const memberIds = await this.members.activeMemberIds(conversationId);
    await this.emitNew([created], memberIds, clientId, { viewerId: senderId, messages: [message] });
    this.pushNewMessage(created, memberIds);
    return message;
  }

  /** Soft delete; only the sender can delete, system and call records can't be deleted. */
  async remove(userId: string, messageId: string): Promise<void> {
    const message = await this.findForMember(userId, messageId);
    if (message.senderId !== userId || message.type === 'SYSTEM' || message.type === 'CALL') {
      throw forbidden(ErrorCode.FORBIDDEN, 'You can only delete your own messages.');
    }
    if (message.deletedAt) return;

    await this.prisma.$transaction([
      this.prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } }),
      this.prisma.messageReaction.deleteMany({ where: { messageId } }),
    ]);
    const memberIds = await this.members.activeMemberIds(message.conversationId);
    this.realtime.emitToUsers(memberIds, ServerEvent.MESSAGE_DELETED, {
      conversationId: message.conversationId,
      messageId,
    });
  }

  /** One reaction per user: PUT replaces the previous emoji. */
  async setReaction(userId: string, messageId: string, emoji: string): Promise<void> {
    const message = await this.findForMember(userId, messageId);
    if (message.deletedAt || message.type === 'SYSTEM') {
      throw notFound(ErrorCode.MESSAGE_NOT_FOUND, 'Message not found.');
    }
    await this.prisma.messageReaction.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId, emoji },
      update: { emoji, createdAt: new Date() },
    });
    await this.emitReactions(message.conversationId, messageId);
  }

  async removeReaction(userId: string, messageId: string): Promise<void> {
    const message = await this.findForMember(userId, messageId);
    const { count } = await this.prisma.messageReaction.deleteMany({
      where: { messageId, userId },
    });
    if (count > 0) await this.emitReactions(message.conversationId, messageId);
  }

  // ───────────── used by conversations and calls ─────────────

  /** SYSTEM message inside the caller's transaction. Publish it afterwards with publish(). */
  createSystem(
    tx: Prisma.TransactionClient,
    conversationId: string,
    input: SystemMessageInput,
    createdAt = new Date(),
  ) {
    const systemData: StoredSystemData = {
      action: input.action,
      actorId: input.actorId,
      targetIds: input.targetIds ?? [],
      ...(input.title !== undefined ? { title: input.title } : {}),
    };
    return tx.message.create({
      data: {
        conversationId,
        senderId: input.actorId,
        type: 'SYSTEM',
        systemData,
        createdAt,
      },
      select: { id: true },
    });
  }

  /** "Video call · 12 min" / "Missed call" record, created when a call is over. */
  async createCallRecord(call: {
    id: string;
    conversationId: string;
    startedById: string;
  }): Promise<void> {
    const now = new Date();
    const [created] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: call.conversationId,
          senderId: call.startedById,
          type: 'CALL',
          callId: call.id,
          createdAt: now,
        },
        include: messageInclude,
      }),
      this.prisma.conversation.update({
        where: { id: call.conversationId },
        data: { lastMessageAt: now },
      }),
    ]);
    const memberIds = await this.members.activeMemberIds(call.conversationId);
    await this.emitNew([created], memberIds);
  }

  /** Emits message:new for already saved messages (e.g. system messages) to the given members. */
  async publish(messageIds: string[], memberIds: string[]): Promise<void> {
    if (messageIds.length === 0 || memberIds.length === 0) return;
    const rows = await this.prisma.message.findMany({
      where: { id: { in: messageIds } },
      include: messageInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    await this.emitNew(rows, memberIds);
  }

  /** Builds Message DTOs for one viewer without N+1: users, posts and stories in batches. */
  async toDtos(
    viewerId: string,
    rows: MessageRow[],
    clientId: string | null = null,
  ): Promise<Message[]> {
    if (rows.length === 0) return [];

    const senders = rows.map((r) => r.sender);
    const knownIds = new Set(senders.map((s) => s.id));
    const extraIds = systemUserIds(rows).filter((id) => !knownIds.has(id));
    const extraUsers = extraIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: extraIds } },
          select: userPreviewSelect,
        })
      : [];

    const postIds = unique(rows.flatMap((r) => (r.postId && !r.deletedAt ? [r.postId] : [])));
    const storyIds = unique(rows.flatMap((r) => (r.storyId && !r.deletedAt ? [r.storyId] : [])));

    const [users, posts, stories] = await Promise.all([
      this.userPreview.build(viewerId, [...senders, ...extraUsers]),
      postIds.length ? this.posts.getByIds(viewerId, postIds) : new Map<string, Post>(),
      storyIds.length ? this.stories.getByIds(viewerId, storyIds) : new Map<string, Story>(),
    ]);
    return rows.map((row) => toMessageDto(row, { users, posts, stories, clientId }));
  }

  // ───────────── private ─────────────

  /**
   * message:new to every member, built for each recipient (story rings and shared
   * posts depend on the viewer). Includes the sender's other tabs.
   */
  private async emitNew(
    rows: MessageRow[],
    memberIds: string[],
    clientId: string | null = null,
    ready?: { viewerId: string; messages: Message[] },
  ): Promise<void> {
    await Promise.all(
      memberIds.map(async (memberId) => {
        const messages =
          ready && ready.viewerId === memberId
            ? ready.messages
            : await this.toDtos(memberId, rows, clientId);
        for (const message of messages) {
          this.realtime.emitToUser(memberId, ServerEvent.MESSAGE_NEW, message);
        }
      }),
    );
  }

  private pushNewMessage(row: MessageRow, memberIds: string[]): void {
    const recipients = memberIds.filter((id) => id !== row.senderId);
    if (recipients.length === 0) return;
    void this.prisma.conversation
      .findUnique({ where: { id: row.conversationId }, select: { isGroup: true, title: true } })
      .then((conversation) => {
        const input = {
          conversationId: row.conversationId,
          groupTitle: conversation?.isGroup ? (conversation.title ?? null) : null,
          senderUsername: row.sender.username,
          senderAvatarUrl: row.sender.avatarUrl,
          type: row.type,
          text: row.text,
          mediaType: row.mediaType,
        };
        for (const userId of recipients) {
          this.push.notify(userId, 'messages', (language) => buildMessagePush(language, input));
        }
      })
      .catch(() => undefined);
  }

  private async emitReactions(conversationId: string, messageId: string): Promise<void> {
    const [reactions, memberIds] = await Promise.all([
      this.prisma.messageReaction.findMany({
        where: { messageId },
        select: { emoji: true, userId: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.members.activeMemberIds(conversationId),
    ]);
    this.realtime.emitToUsers(memberIds, ServerEvent.MESSAGE_REACTION, {
      conversationId,
      messageId,
      reactions,
    });
  }

  /** The message, if the user is an active member of its conversation (404 otherwise). */
  private async findForMember(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, senderId: true, type: true, deletedAt: true },
    });
    if (!message || !(await this.members.isActiveMember(userId, message.conversationId))) {
      throw notFound(ErrorCode.MESSAGE_NOT_FOUND, 'Message not found.');
    }
    return message;
  }

  private async validateContent(
    senderId: string,
    conversationId: string,
    dto: SendMessageInput,
  ): Promise<void> {
    if (dto.replyToId) {
      const replyTo = await this.prisma.message.findFirst({
        where: { id: dto.replyToId, conversationId },
        select: { id: true },
      });
      if (!replyTo) throw notFound(ErrorCode.MESSAGE_NOT_FOUND, 'Message not found.');
    }

    if (dto.type === 'POST_SHARE' && dto.postId) {
      const post = await this.prisma.post.findUnique({
        where: { id: dto.postId },
        select: { authorId: true },
      });
      if (!post || !(await this.follows.canViewContent(senderId, post.authorId))) {
        throw notFound(ErrorCode.POST_NOT_FOUND, 'Post not found.');
      }
    }

    if (dto.type === 'STORY_REPLY' && dto.storyId) {
      const story = await this.prisma.story.findUnique({
        where: { id: dto.storyId },
        select: { authorId: true, expiresAt: true },
      });
      if (
        !story ||
        story.expiresAt <= new Date() ||
        !(await this.follows.canViewContent(senderId, story.authorId))
      ) {
        throw notFound(ErrorCode.STORY_NOT_FOUND, 'Story not found.');
      }
      if (
        story.authorId === senderId ||
        !(await this.members.isActiveMember(story.authorId, conversationId))
      ) {
        throw badRequest(
          ErrorCode.VALIDATION_FAILED,
          'A story reply must be sent to a chat with the story author.',
        );
      }
    }
  }
}

const unique = (ids: string[]) => [...new Set(ids)];
