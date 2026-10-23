import { Injectable, Logger } from '@nestjs/common';
import type { Notification as NotificationRow } from '@prisma/client';
import {
  type Notification,
  type NotificationType,
  type Page,
  type PageQuery,
  type PushPayload,
  ServerEvent,
} from '@instagram/shared';
import { cursorArgs } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowsService } from '../follows/follows.service';
import { type PushCategory, PushService } from '../push/push.service';
import { type NotificationPushKey, pushMessages, truncate } from '../push/push-messages';
import { RealtimeService } from '../realtime/realtime.service';
import { UserPreviewService, userPreviewSelect } from '../users/user-preview.service';
import {
  type NotificationCommentRef,
  type NotificationPostRef,
  toNotificationDto,
} from './notifications.mapper';

export type NotificationInput = {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  storyId?: string;
};

/** Which NotificationSettings toggle controls the push for each type. */
export const notificationPushCategory: Record<NotificationType, PushCategory> = {
  POST_LIKE: 'likes',
  COMMENT_LIKE: 'likes',
  STORY_LIKE: 'likes',
  COMMENT: 'comments',
  COMMENT_REPLY: 'comments',
  MENTION: 'comments',
  POST_TAG: 'comments',
  FOLLOW: 'follows',
  FOLLOW_REQUEST: 'follows',
  FOLLOW_ACCEPTED: 'follows',
  LIVE_STARTED: 'follows',
};

/**
 * Notifications (NOTIF-*). create/remove are a CONTRACT used by likes, comments, follows, stories:
 * the signatures are fixed.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly follows: FollowsService,
    private readonly userPreview: UserPreviewService,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
  ) {}

  /**
   * Creates a notification, emits `notification:new` and sends a web push.
   * Does nothing if recipientId === actorId, the users are blocked, or an identical
   * unread notification already exists. Never throws: callers don't await errors.
   */
  async create(input: NotificationInput): Promise<void> {
    try {
      if (input.recipientId === input.actorId) return;
      if (await this.follows.isBlockedBetween(input.recipientId, input.actorId)) return;

      const where = this.matchWhere(input);
      const duplicate = await this.prisma.notification.findFirst({
        where: { ...where, isRead: false },
        select: { id: true },
      });
      if (duplicate) return;

      const row = await this.prisma.notification.create({ data: where });
      const [notification] = await this.toDtos(input.recipientId, [row]);
      if (!notification) return;

      this.realtime.emitToUser(input.recipientId, ServerEvent.NOTIFICATION_NEW, notification);
      this.push.notify(input.recipientId, notificationPushCategory[row.type], (language) =>
        buildNotificationPush(notification, language),
      );
    } catch (error) {
      this.logger.error(`Failed to create ${input.type} notification: ${String(error)}`);
    }
  }

  /**
   * Removes a notification when the action is undone (unlike, unfollow, delete comment).
   * Matches by all provided fields.
   */
  async remove(input: NotificationInput): Promise<void> {
    try {
      await this.prisma.notification.deleteMany({ where: this.matchWhere(input, false) });
    } catch (error) {
      this.logger.error(`Failed to remove ${input.type} notification: ${String(error)}`);
    }
  }

  async list(userId: string, query: PageQuery): Promise<Page<Notification>> {
    const blocked = await this.follows.getBlockedUserIds(userId);
    const rows = await this.prisma.notification.findMany({
      where: { recipientId: userId, actorId: { notIn: blocked } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query),
    });
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: await this.toDtos(userId, pageRows),
      nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
    };
  }

  async countUnread(userId: string): Promise<number> {
    const blocked = await this.follows.getBlockedUserIds(userId);
    return this.prisma.notification.count({
      where: { recipientId: userId, isRead: false, actorId: { notIn: blocked } },
    });
  }

  async readAll(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * @param strict when true, missing optional ids match NULL (exact notification);
   *   when false, they are ignored ("match by all provided fields").
   */
  private matchWhere(input: NotificationInput, strict = true) {
    const optional = (value: string | undefined) => (strict ? (value ?? null) : value);
    return {
      recipientId: input.recipientId,
      actorId: input.actorId,
      type: input.type,
      postId: optional(input.postId),
      commentId: optional(input.commentId),
      storyId: optional(input.storyId),
    };
  }

  /** Maps rows to DTOs with a fixed number of queries (no N+1). Keeps the order. */
  private async toDtos(viewerId: string, rows: NotificationRow[]): Promise<Notification[]> {
    if (rows.length === 0) return [];
    const unique = (ids: (string | null)[]) => [...new Set(ids.filter((id): id is string => !!id))];
    const actorIds = unique(rows.map((r) => r.actorId));
    const postIds = unique(rows.map((r) => r.postId));
    const commentIds = unique(rows.map((r) => r.commentId));

    const [actors, posts, comments, followStatuses] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: userPreviewSelect }),
      postIds.length
        ? this.prisma.post.findMany({
            where: { id: { in: postIds } },
            select: {
              id: true,
              type: true,
              media: {
                orderBy: { order: 'asc' },
                take: 1,
                select: { url: true, thumbnailUrl: true },
              },
            },
          })
        : [],
      commentIds.length
        ? this.prisma.comment.findMany({
            where: { id: { in: commentIds } },
            select: { id: true, text: true },
          })
        : [],
      this.follows.getFollowStatuses(viewerId, actorIds),
    ]);

    const previews = await this.userPreview.build(viewerId, actors);
    const postMap = new Map<string, NotificationPostRef>(
      posts.map((p) => {
        const first = p.media[0];
        return [
          p.id,
          {
            id: p.id,
            type: p.type,
            thumbnailUrl: first ? (first.thumbnailUrl ?? first.url) : null,
          },
        ];
      }),
    );
    const commentMap = new Map<string, NotificationCommentRef>(comments.map((c) => [c.id, c]));

    const result: Notification[] = [];
    for (const row of rows) {
      const actor = previews.get(row.actorId);
      if (!actor) continue;
      result.push(
        toNotificationDto(
          row,
          actor,
          row.postId ? postMap.get(row.postId) : undefined,
          row.commentId ? commentMap.get(row.commentId) : undefined,
          followStatuses.get(row.actorId) ?? 'NONE',
        ),
      );
    }
    return result;
  }
}

/** Localized push for a notification (docs/spec/push.md §4). */
export function buildNotificationPush(
  notification: Notification,
  language: keyof typeof pushMessages,
): PushPayload {
  const messages = pushMessages[language];
  const key: NotificationPushKey =
    notification.type === 'POST_LIKE' && notification.post?.type === 'REEL'
      ? 'REEL_LIKE'
      : notification.type;
  const body = messages[key]({
    actor: notification.actor.username,
    text: notification.comment ? truncate(notification.comment.text) : undefined,
  });
  return {
    type: 'NOTIFICATION',
    title: messages.title,
    body,
    icon: notification.actor.avatarUrl,
    url: notificationUrl(notification),
    tag: `notification:${notification.id}`,
  };
}

function notificationUrl(n: Notification): string {
  switch (n.type) {
    case 'FOLLOW':
    case 'FOLLOW_ACCEPTED':
      return `/${n.actor.username}`;
    case 'FOLLOW_REQUEST':
      return '/notifications';
    case 'STORY_LIKE':
      return '/archive/stories';
    case 'LIVE_STARTED':
      return `/live/${n.actor.username}`;
    default:
      if (!n.post) return '/notifications';
      return n.post.type === 'REEL' ? `/reel/${n.post.id}` : `/p/${n.post.id}`;
  }
}
