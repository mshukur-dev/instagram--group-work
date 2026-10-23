import { Injectable } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  type ChangePasswordInput,
  ErrorCode,
  type Language,
  type Me,
  type MessagePermission,
  type Theme,
  type UpdateProfileInput,
  type UserPreview,
  type UserProfile,
} from '@instagram/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest, conflict, notFound } from '../../common/errors/app-exception';
import { acceptAllPendingTx } from '../follows/follow-graph';
import { FollowsService } from '../follows/follows.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserPreviewService, userPreviewSelect } from './user-preview.service';
import { toUserProfile } from './users.mapper';

/** Columns of User that PATCH /users/me and PATCH /settings may change. */
export type UserUpdateData = UpdateProfileInput & {
  showActivityStatus?: boolean;
  messagePermission?: MessagePermission;
  theme?: Theme;
  language?: Language;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userPreview: UserPreviewService,
    private readonly follows: FollowsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Current user with unread counters (sidebar badges). */
  async getMe(userId: string): Promise<Me> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound(ErrorCode.USER_NOT_FOUND, 'User not found.');

    const [preview, unreadNotificationsCount, unreadConversationsCount, pendingFollowRequestsCount] =
      await Promise.all([
        this.userPreview.buildOne(userId, user),
        this.prisma.notification.count({ where: { recipientId: userId, isRead: false } }),
        this.countUnreadConversations(userId),
        this.prisma.follow.count({ where: { followingId: userId, status: 'PENDING' } }),
      ]);

    return {
      ...preview,
      email: user.email,
      bio: user.bio,
      website: user.website,
      isPrivate: user.isPrivate,
      postsCount: user.postsCount,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      language: user.language,
      theme: user.theme,
      hasPassword: user.passwordHash !== null,
      role: user.role,
      unreadNotificationsCount,
      unreadConversationsCount,
      pendingFollowRequestsCount,
    };
  }

  /** Conversations with a message from someone else after my lastReadAt. */
  async countUnreadConversations(userId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM conversation_members m
      WHERE m."userId" = ${userId}
        AND m."leftAt" IS NULL
        AND EXISTS (
          SELECT 1 FROM messages msg
          WHERE msg."conversationId" = m."conversationId"
            AND msg."senderId" <> ${userId}
            AND msg."createdAt" > m."lastReadAt"
        )`;
    return Number(rows[0]?.count ?? 0);
  }

  /** Finds a user by username or throws USER_NOT_FOUND. Does not check blocks. */
  async findByUsernameOrThrow(username: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });
    if (!user) throw userNotFound();
    return user;
  }

  /**
   * Finds a user the viewer may interact with: 404 also when either side blocked the other
   * (we never reveal that a blocked account exists).
   */
  async findVisibleByUsername(viewerId: string, username: string): Promise<User> {
    const user = await this.findByUsernameOrThrow(username);
    if (await this.follows.isBlockedBetween(viewerId, user.id)) throw userNotFound();
    return user;
  }

  async updateMe(userId: string, dto: UpdateProfileInput): Promise<Me> {
    await this.updateUser(userId, dto);
    return this.getMe(userId);
  }

  /**
   * Updates user columns. Shared by PATCH /users/me and PATCH /settings.
   * Switching private → public auto-accepts all pending follow requests.
   */
  async updateUser(userId: string, data: UserUpdateData): Promise<void> {
    if (data.username !== undefined) {
      const taken = await this.prisma.user.findFirst({
        where: { username: data.username, id: { not: userId } },
        select: { id: true },
      });
      if (taken) throw usernameTaken();
    }

    let accepted: string[] = [];
    try {
      accepted = await this.prisma.$transaction(async (tx) => {
        const current = await tx.user.findUnique({
          where: { id: userId },
          select: { isPrivate: true },
        });
        if (!current) throw userNotFound();
        await tx.user.update({ where: { id: userId }, data });
        return current.isPrivate && data.isPrivate === false ? acceptAllPendingTx(tx, userId) : [];
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw usernameTaken();
      }
      throw e;
    }

    for (const followerId of accepted) {
      await this.notifyRequestAccepted(userId, followerId);
    }
  }

  /** Request notification → "started following you" for me, "accepted your request" for them. */
  async notifyRequestAccepted(ownerId: string, followerId: string): Promise<void> {
    await this.notifications.remove({
      recipientId: ownerId,
      actorId: followerId,
      type: 'FOLLOW_REQUEST',
    });
    await this.notifications.create({ recipientId: ownerId, actorId: followerId, type: 'FOLLOW' });
    await this.notifications.create({
      recipientId: followerId,
      actorId: ownerId,
      type: 'FOLLOW_ACCEPTED',
    });
  }

  /**
   * Changes the password, or sets the first one for a Google-only account.
   * Other sessions are logged out; the current one stays.
   */
  async changePassword(
    userId: string,
    sessionId: string,
    dto: ChangePasswordInput,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw userNotFound();

    if (user.passwordHash !== null) {
      const valid =
        dto.currentPassword !== undefined &&
        (await argon2.verify(user.passwordHash, dto.currentPassword));
      if (!valid) {
        throw badRequest(ErrorCode.WRONG_PASSWORD, 'Your old password was entered incorrectly.');
      }
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.session.deleteMany({ where: { userId, id: { not: sessionId } } }),
    ]);
  }

  /**
   * Profile page. If the user blocked the viewer → 404.
   * If the viewer blocked the user → profile with isBlocked=true and no content.
   */
  async getProfile(viewerId: string, username: string): Promise<UserProfile> {
    const user = await this.findByUsernameOrThrow(username);
    const isMe = user.id === viewerId;
    if (user.bannedAt && !isMe) throw userNotFound(); // ADMIN-4: hidden from everyone

    const [blocks, follows, preview] = await Promise.all([
      isMe
        ? Promise.resolve([])
        : this.prisma.block.findMany({
            where: {
              OR: [
                { blockerId: viewerId, blockedId: user.id },
                { blockerId: user.id, blockedId: viewerId },
              ],
            },
            select: { blockerId: true },
          }),
      isMe
        ? Promise.resolve([])
        : this.prisma.follow.findMany({
            where: {
              OR: [
                { followerId: viewerId, followingId: user.id },
                { followerId: user.id, followingId: viewerId, status: 'ACCEPTED' },
              ],
            },
            select: { followerId: true, status: true },
          }),
      this.userPreview.buildOne(viewerId, user),
    ]);

    if (blocks.some((b) => b.blockerId === user.id)) throw userNotFound();
    const isBlocked = blocks.length > 0;

    const myFollow = follows.find((f) => f.followerId === viewerId);
    const followStatus = myFollow?.status ?? 'NONE';
    const canViewContent =
      isMe || (!isBlocked && (!user.isPrivate || followStatus === 'ACCEPTED'));

    return toUserProfile(user, preview, {
      isMe,
      followStatus,
      followsMe: follows.some((f) => f.followerId === user.id),
      isBlocked,
      canViewContent,
    });
  }

  /**
   * "Suggested for you": people followed by people I follow (most mutual first),
   * then popular public accounts as a fallback. Excludes me, people I already
   * follow or requested, and blocks in either direction.
   */
  async suggestions(viewerId: string, limit: number): Promise<UserPreview[]> {
    const [myFollows, blockedIds] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: viewerId },
        select: { followingId: true, status: true },
      }),
      this.follows.getBlockedUserIds(viewerId),
    ]);
    const acceptedIds = myFollows.filter((f) => f.status === 'ACCEPTED').map((f) => f.followingId);
    const excluded = [viewerId, ...myFollows.map((f) => f.followingId), ...blockedIds];

    const ids: string[] = [];
    if (acceptedIds.length > 0) {
      const mutual = await this.prisma.follow.groupBy({
        by: ['followingId'],
        where: {
          followerId: { in: acceptedIds },
          status: 'ACCEPTED',
          followingId: { notIn: excluded },
        },
        _count: { followerId: true },
        orderBy: [{ _count: { followerId: 'desc' } }, { followingId: 'asc' }],
        take: limit,
      });
      ids.push(...mutual.map((m) => m.followingId));
    }

    const byId = new Map<string, Prisma.UserGetPayload<{ select: typeof userPreviewSelect }>>();
    if (ids.length > 0) {
      const rows = await this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: userPreviewSelect,
      });
      for (const row of rows) byId.set(row.id, row);
    }
    const users = ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });

    if (users.length < limit) {
      const popular = await this.prisma.user.findMany({
        where: { isPrivate: false, id: { notIn: [...excluded, ...ids] } },
        orderBy: [{ followersCount: 'desc' }, { id: 'asc' }],
        take: limit - users.length,
        select: userPreviewSelect,
      });
      users.push(...popular);
    }

    return this.userPreview.buildList(viewerId, users);
  }
}

const userNotFound = () => notFound(ErrorCode.USER_NOT_FOUND, 'User not found.');
const usernameTaken = () => conflict(ErrorCode.USERNAME_TAKEN, "This username isn't available.");
