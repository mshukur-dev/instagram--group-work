import { Injectable } from '@nestjs/common';
import type { ViewerFollowStatus } from '@instagram/shared';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Social graph and visibility rules (docs/spec/database.md §4).
 * Used by posts, stories, search, direct… to decide what a viewer may see.
 */
@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  /** True if either user blocked the other. */
  async isBlockedBetween(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { blockerId: true },
    });
    return block !== null;
  }

  /** Ids of users the viewer blocked or who blocked the viewer — exclude them from lists. */
  async getBlockedUserIds(viewerId: string): Promise<string[]> {
    const blocks = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
      select: { blockerId: true, blockedId: true },
    });
    return blocks.map((b) => (b.blockerId === viewerId ? b.blockedId : b.blockerId));
  }

  /** Ids of users the viewer follows with ACCEPTED status. */
  async getFollowingIds(viewerId: string): Promise<string[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: viewerId, status: 'ACCEPTED' },
      select: { followingId: true },
    });
    return rows.map((r) => r.followingId);
  }

  /**
   * Can the viewer see posts / reels / stories of the owner?
   * Me, or public account, or accepted follower — and no block in either direction.
   */
  async canViewContent(viewerId: string, ownerId: string): Promise<boolean> {
    if (viewerId === ownerId) return true;
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { isPrivate: true },
    });
    if (!owner) return false;
    if (await this.isBlockedBetween(viewerId, ownerId)) return false;
    if (!owner.isPrivate) return true;
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: ownerId } },
      select: { status: true },
    });
    return follow?.status === 'ACCEPTED';
  }

  /** Viewer → each user follow status, in one query. */
  async getFollowStatuses(
    viewerId: string,
    userIds: string[],
  ): Promise<Map<string, ViewerFollowStatus>> {
    const result = new Map<string, ViewerFollowStatus>(userIds.map((id) => [id, 'NONE']));
    if (userIds.length === 0) return result;
    const rows = await this.prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: userIds } },
      select: { followingId: true, status: true },
    });
    for (const row of rows) result.set(row.followingId, row.status);
    return result;
  }
}
