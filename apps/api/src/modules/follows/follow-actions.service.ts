import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ErrorCode,
  type FilteredPageQuery,
  type FollowStatus,
  type Page,
  type PageQuery,
  type UserListItem,
  type UserPreview,
} from '@instagram/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest, forbidden, notFound } from '../../common/errors/app-exception';
import { toPageBy } from '../../common/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import { UserPreviewService, userPreviewSelect } from '../users/user-preview.service';
import { toUserListItem } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import { acceptFollowTx, removeFollowTx } from './follow-graph';
import { FollowsService } from './follows.service';

/** Follow, unfollow, follow requests and followers / following lists (FOLLOW-1..3, PROFILE-5). */
@Injectable()
export class FollowActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly follows: FollowsService,
    private readonly users: UsersService,
    private readonly userPreview: UserPreviewService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Public account → ACCEPTED, private → PENDING request. Idempotent. */
  async follow(viewerId: string, username: string): Promise<{ followStatus: FollowStatus }> {
    const target = await this.users.findByUsernameOrThrow(username);
    if (target.id === viewerId) {
      throw badRequest(ErrorCode.CANNOT_FOLLOW_SELF, "You can't follow yourself.");
    }
    if (await this.follows.isBlockedBetween(viewerId, target.id)) {
      throw notFound(ErrorCode.USER_NOT_FOUND, 'User not found.');
    }

    const status: FollowStatus = target.isPrivate ? 'PENDING' : 'ACCEPTED';
    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.follow.findUnique({
        where: { followerId_followingId: { followerId: viewerId, followingId: target.id } },
        select: { status: true },
      });
      if (existing) return { status: existing.status, isNew: false };

      const { count } = await tx.follow.createMany({
        data: [{ followerId: viewerId, followingId: target.id, status }],
        skipDuplicates: true,
      });
      if (count === 0) return { status, isNew: false };
      if (status === 'ACCEPTED') {
        await tx.user.update({
          where: { id: viewerId },
          data: { followingCount: { increment: 1 } },
        });
        await tx.user.update({
          where: { id: target.id },
          data: { followersCount: { increment: 1 } },
        });
      }
      return { status, isNew: true };
    });

    if (created.isNew) {
      await this.notifications.create({
        recipientId: target.id,
        actorId: viewerId,
        type: created.status === 'PENDING' ? 'FOLLOW_REQUEST' : 'FOLLOW',
      });
    }
    return { followStatus: created.status };
  }

  /** Unfollow or cancel a pending request. Idempotent. */
  async unfollow(viewerId: string, username: string): Promise<void> {
    const target = await this.users.findByUsernameOrThrow(username);
    await this.removeFollow(viewerId, target.id);
  }

  /** Remove someone from my followers (FOLLOW-3). Idempotent. */
  async removeFollower(viewerId: string, username: string): Promise<void> {
    const follower = await this.users.findByUsernameOrThrow(username);
    await this.removeFollow(follower.id, viewerId);
  }

  async listRequests(viewerId: string, query: PageQuery): Promise<Page<UserPreview>> {
    const blockedIds = await this.follows.getBlockedUserIds(viewerId);
    const rows = await this.prisma.follow.findMany({
      where: { followingId: viewerId, status: 'PENDING', followerId: { notIn: blockedIds } },
      orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor
        ? {
            skip: 1,
            cursor: {
              followerId_followingId: { followerId: query.cursor, followingId: viewerId },
            },
          }
        : {}),
      select: { followerId: true, follower: { select: userPreviewSelect } },
    });
    const previews = await this.userPreview.build(
      viewerId,
      rows.map((r) => r.follower),
    );
    return toPageBy(
      rows,
      query.limit,
      (r) => r.followerId,
      (r) => previews.get(r.followerId) ?? this.userPreview.toPreview(r.follower),
    );
  }

  async acceptRequest(viewerId: string, followerId: string): Promise<void> {
    const accepted = await this.prisma.$transaction((tx) =>
      acceptFollowTx(tx, followerId, viewerId),
    );
    if (!accepted) throw requestNotFound();
    await this.users.notifyRequestAccepted(viewerId, followerId);
  }

  async declineRequest(viewerId: string, followerId: string): Promise<void> {
    const { count } = await this.prisma.follow.deleteMany({
      where: { followerId, followingId: viewerId, status: 'PENDING' },
    });
    if (count === 0) throw requestNotFound();
    await this.notifications.remove({
      recipientId: viewerId,
      actorId: followerId,
      type: 'FOLLOW_REQUEST',
    });
  }

  listFollowers(
    viewerId: string,
    username: string,
    query: FilteredPageQuery,
  ): Promise<Page<UserListItem>> {
    return this.listGraph(viewerId, username, query, 'followers');
  }

  listFollowing(
    viewerId: string,
    username: string,
    query: FilteredPageQuery,
  ): Promise<Page<UserListItem>> {
    return this.listGraph(viewerId, username, query, 'following');
  }

  /** Deletes a follow (any status) with counters and removes its notification. */
  private async removeFollow(followerId: string, followingId: string): Promise<void> {
    const removed = await this.prisma.$transaction((tx) =>
      removeFollowTx(tx, followerId, followingId),
    );
    if (removed) {
      await this.notifications.remove({
        recipientId: followingId,
        actorId: followerId,
        type: removed === 'PENDING' ? 'FOLLOW_REQUEST' : 'FOLLOW',
      });
    }
  }

  /**
   * Accepted followers / following of a user, newest first.
   * Cursor = id of the last user in the page.
   */
  private async listGraph(
    viewerId: string,
    username: string,
    query: FilteredPageQuery,
    kind: 'followers' | 'following',
  ): Promise<Page<UserListItem>> {
    const owner = await this.users.findVisibleByUsername(viewerId, username);
    if (!(await this.follows.canViewContent(viewerId, owner.id))) {
      throw forbidden(ErrorCode.PRIVATE_ACCOUNT, 'This account is private.');
    }

    const blockedIds = await this.follows.getBlockedUserIds(viewerId);
    const userFilter: Prisma.UserWhereInput | undefined = query.q
      ? {
          OR: [
            { username: { contains: query.q, mode: 'insensitive' } },
            { fullName: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const isFollowers = kind === 'followers';
    const where: Prisma.FollowWhereInput = isFollowers
      ? {
          followingId: owner.id,
          status: 'ACCEPTED',
          followerId: { notIn: blockedIds },
          follower: userFilter,
        }
      : {
          followerId: owner.id,
          status: 'ACCEPTED',
          followingId: { notIn: blockedIds },
          following: userFilter,
        };
    const cursor = query.cursor
      ? isFollowers
        ? { followerId: query.cursor, followingId: owner.id }
        : { followerId: owner.id, followingId: query.cursor }
      : undefined;

    const rows = await this.prisma.follow.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        isFollowers ? { followerId: 'desc' } : { followingId: 'desc' },
      ],
      take: query.limit + 1,
      ...(cursor ? { skip: 1, cursor: { followerId_followingId: cursor } } : {}),
      select: {
        follower: { select: userPreviewSelect },
        following: { select: userPreviewSelect },
      },
    });
    const users = rows.map((r) => (isFollowers ? r.follower : r.following));

    const ids = users.map((u) => u.id);
    const [previews, statuses] = await Promise.all([
      this.userPreview.build(viewerId, users),
      this.follows.getFollowStatuses(viewerId, ids),
    ]);
    return toPageBy(
      users,
      query.limit,
      (u) => u.id,
      (u) =>
        toUserListItem(
          previews.get(u.id) ?? this.userPreview.toPreview(u),
          statuses.get(u.id) ?? 'NONE',
          viewerId,
        ),
    );
  }
}

const requestNotFound = () =>
  notFound(ErrorCode.FOLLOW_REQUEST_NOT_FOUND, 'Follow request not found.');
