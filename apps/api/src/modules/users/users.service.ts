import { Injectable } from '@nestjs/common';
import { ErrorCode, type Me } from '@instagram/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { notFound } from '../../common/errors/app-exception';
import { UserPreviewService } from './user-preview.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userPreview: UserPreviewService,
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
}
