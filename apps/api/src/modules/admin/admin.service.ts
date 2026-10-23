import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ErrorCode,
  type AdminAction,
  type AdminComment,
  type AdminCounts,
  type AdminPost,
  type AdminPostsQuery,
  type AdminSearchQuery,
  type AdminStats,
  type AdminUser,
  type AdminUsersQuery,
  type BanUserInput,
  type Page,
} from '@instagram/shared';
import { forbidden, notFound } from '../../common/errors/app-exception';
import { cursorArgs, toPage } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { CommentsService } from '../comments/comments.service';
import { LivesService } from '../lives/lives.service';
import { PostsService } from '../posts/posts.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  adminActionSelect,
  adminCommentSelect,
  adminPostSelect,
  adminUserRefSelect,
  adminUserSelect,
  toAdminAction,
  toAdminComment,
  toAdminPost,
  toAdminUser,
} from './admin.mapper';

const DAY_MS = 24 * 60 * 60 * 1000;
const newestFirst = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

const userNotFound = () => notFound(ErrorCode.USER_NOT_FOUND, 'User not found.');

/** Admin panel (ADMIN-1…ADMIN-6, docs/spec/api.md "Admin"). Callers are checked by AdminGuard. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
    private readonly lives: LivesService,
  ) {}

  // ───────────── ADMIN-2: dashboard ─────────────

  async stats(): Promise<AdminStats> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * DAY_MS);

    const onlineIds = this.realtime.onlineUserIds();
    const [total, today, last7Days, bannedUsers, onlineUsers] = await Promise.all([
      this.counts(),
      this.counts(startOfToday),
      this.counts(weekAgo),
      this.prisma.user.count({ where: { bannedAt: { not: null } } }),
      this.prisma.user.findMany({
        where: { id: { in: onlineIds } },
        select: adminUserRefSelect,
        orderBy: { lastSeenAt: 'desc' },
        take: 30,
      }),
    ]);
    return { total, today, last7Days, online: onlineIds.length, onlineUsers, bannedUsers };
  }

  private async counts(since?: Date): Promise<AdminCounts> {
    const createdAt = since ? { gte: since } : undefined;
    const [users, posts, reels, stories, messages] = await Promise.all([
      this.prisma.user.count({ where: { createdAt } }),
      this.prisma.post.count({ where: { type: 'POST', createdAt } }),
      this.prisma.post.count({ where: { type: 'REEL', createdAt } }),
      this.prisma.story.count({ where: { createdAt } }),
      // system lines in group chats are not messages people wrote
      this.prisma.message.count({ where: { type: { not: 'SYSTEM' }, createdAt } }),
    ]);
    return { users, posts, reels, stories, messages };
  }

  // ───────────── ADMIN-3 / ADMIN-4: users ─────────────

  async users(query: AdminUsersQuery): Promise<Page<AdminUser>> {
    const where: Prisma.UserWhereInput = {};
    if (query.q) {
      const contains = { contains: query.q, mode: 'insensitive' as const };
      where.OR = [{ username: contains }, { fullName: contains }, { email: contains }];
    }
    if (query.banned !== undefined) {
      where.bannedAt = query.banned ? { not: null } : null;
    }
    const dir = query.sort === 'oldest' ? 'asc' : 'desc';
    const rows = await this.prisma.user.findMany({
      where,
      select: adminUserSelect,
      orderBy: [{ createdAt: dir }, { id: dir }],
      ...cursorArgs(query),
    });
    return toPage(rows, query.limit, (row) => toAdminUser(row, this.realtime.isOnline(row.id)));
  }

  async user(id: string): Promise<AdminUser> {
    const row = await this.prisma.user.findUnique({ where: { id }, select: adminUserSelect });
    if (!row) throw userNotFound();
    return toAdminUser(row, this.realtime.isOnline(row.id));
  }

  /**
   * ADMIN-4: the user can't log in, every session ends right away (sockets too),
   * and the profile and content disappear for everyone (FollowsService treats a ban as a block).
   */
  async ban(adminId: string, userId: string, dto: BanUserInput): Promise<AdminUser> {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!target) throw userNotFound();
    if (userId === adminId || target.role === 'ADMIN') {
      throw forbidden(ErrorCode.CANNOT_BAN_ADMIN, 'Administrators cannot be banned.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { bannedAt: new Date(), banReason: dto.reason },
      }),
      this.prisma.session.deleteMany({ where: { userId } }),
      this.prisma.pushSubscription.deleteMany({ where: { userId } }),
      this.prisma.adminAction.create({
        data: {
          adminId,
          type: 'BAN_USER',
          targetUserId: userId,
          details: { reason: dto.reason },
        },
      }),
    ]);

    // side effects after the write
    this.realtime.disconnectUser(userId);
    await this.lives.endAllOf(userId);
    return this.user(userId);
  }

  async unban(adminId: string, userId: string): Promise<AdminUser> {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bannedAt: true },
    });
    if (!target) throw userNotFound();
    if (target.bannedAt) {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: userId },
          data: { bannedAt: null, banReason: null },
        }),
        this.prisma.adminAction.create({
          data: { adminId, type: 'UNBAN_USER', targetUserId: userId },
        }),
      ]);
    }
    return this.user(userId);
  }

  // ───────────── ADMIN-5: content ─────────────

  async postList(query: AdminPostsQuery): Promise<Page<AdminPost>> {
    const where: Prisma.PostWhereInput = query.type ? { type: query.type } : {};
    if (query.q) {
      where.OR = [
        { author: { username: { contains: query.q, mode: 'insensitive' } } },
        { caption: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.post.findMany({
      where,
      select: adminPostSelect,
      orderBy: newestFirst,
      ...cursorArgs(query),
    });
    return toPage(rows, query.limit, toAdminPost);
  }

  async commentList(query: AdminSearchQuery): Promise<Page<AdminComment>> {
    const rows = await this.prisma.comment.findMany({
      where: query.q
        ? {
            OR: [
              { author: { username: { contains: query.q, mode: 'insensitive' } } },
              { text: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {},
      select: adminCommentSelect,
      orderBy: newestFirst,
      ...cursorArgs(query),
    });
    return toPage(rows, query.limit, toAdminComment);
  }

  /** Counters, hashtags and Cloudinary files are handled by PostsService. */
  async deletePost(adminId: string, postId: string): Promise<void> {
    const post = await this.posts.removeAsAdmin(postId);
    await this.prisma.adminAction.create({
      data: {
        adminId,
        type: 'DELETE_POST',
        targetUserId: post.authorId,
        targetId: postId,
        details: { postType: post.type, caption: post.caption?.slice(0, 200) ?? null },
      },
    });
  }

  async deleteComment(adminId: string, commentId: string): Promise<void> {
    const comment = await this.comments.removeAsAdmin(commentId);
    await this.prisma.adminAction.create({
      data: {
        adminId,
        type: 'DELETE_COMMENT',
        targetUserId: comment.authorId,
        targetId: commentId,
        details: { text: comment.text.slice(0, 200) },
      },
    });
  }

  // ───────────── ADMIN-6: audit log ─────────────

  async actions(query: AdminSearchQuery): Promise<Page<AdminAction>> {
    const username = query.q ? { contains: query.q, mode: 'insensitive' as const } : undefined;
    const rows = await this.prisma.adminAction.findMany({
      where: username ? { OR: [{ admin: { username } }, { targetUser: { username } }] } : {},
      select: adminActionSelect,
      orderBy: newestFirst,
      ...cursorArgs(query),
    });
    return toPage(rows, query.limit, toAdminAction);
  }
}
