import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ErrorCode, type Hashtag, type SearchQuery, type UserPreview } from '@instagram/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { notFound } from '../../common/errors/app-exception';
import { FollowsService } from '../follows/follows.service';
import { UserPreviewService, userPreviewSelect } from '../users/user-preview.service';

/** Max entries kept in "Recent" search history per user. */
export const SEARCH_HISTORY_MAX = 20;

/** SEARCH-1 (users), SEARCH-2 (hashtag suggestions), SEARCH-3 (history). */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly follows: FollowsService,
    private readonly userPreview: UserPreviewService,
  ) {}

  /**
   * Case-insensitive match on username or full name.
   * Prefix matches come first, then "contains" matches; popular accounts first inside each group.
   * Users with a block in either direction are hidden.
   */
  async searchUsers(viewerId: string, { q, limit }: SearchQuery): Promise<UserPreview[]> {
    const query = q.replace(/^@+/, '');
    if (!query) return [];
    const blockedIds = await this.follows.getBlockedUserIds(viewerId);
    const orderBy: Prisma.UserOrderByWithRelationInput[] = [
      { followersCount: 'desc' },
      { id: 'asc' },
    ];

    const prefix = await this.prisma.user.findMany({
      where: {
        id: { notIn: blockedIds },
        OR: [
          { username: { startsWith: query, mode: 'insensitive' } },
          { fullName: { startsWith: query, mode: 'insensitive' } },
        ],
      },
      orderBy,
      take: limit,
      select: userPreviewSelect,
    });

    const users = [...prefix];
    if (users.length < limit) {
      const contains = await this.prisma.user.findMany({
        where: {
          id: { notIn: [...blockedIds, ...prefix.map((u) => u.id)] },
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { fullName: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy,
        take: limit - users.length,
        select: userPreviewSelect,
      });
      users.push(...contains);
    }
    return this.userPreview.buildList(viewerId, users);
  }

  /** Hashtags by prefix (leading '#' ignored), most used first. */
  async searchHashtags({ q, limit }: SearchQuery): Promise<Hashtag[]> {
    const name = q.replace(/^#+/, '').toLowerCase();
    if (!name) return [];
    return this.prisma.hashtag.findMany({
      where: { name: { startsWith: name }, postsCount: { gt: 0 } },
      orderBy: [{ postsCount: 'desc' }, { name: 'asc' }],
      take: limit,
      select: { name: true, postsCount: true },
    });
  }

  /** Recent searches, latest first, without blocked users. */
  async getHistory(viewerId: string): Promise<UserPreview[]> {
    const blockedIds = await this.follows.getBlockedUserIds(viewerId);
    const rows = await this.prisma.searchHistory.findMany({
      where: { searcherId: viewerId, searchedId: { notIn: blockedIds } },
      orderBy: { createdAt: 'desc' },
      take: SEARCH_HISTORY_MAX,
      select: { searched: { select: userPreviewSelect } },
    });
    return this.userPreview.buildList(
      viewerId,
      rows.map((r) => r.searched),
    );
  }

  /** Adds (or moves to the top) a user in my history; keeps the latest SEARCH_HISTORY_MAX. */
  async addToHistory(viewerId: string, userId: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists || (await this.follows.isBlockedBetween(viewerId, userId))) {
      throw notFound(ErrorCode.USER_NOT_FOUND, 'User not found.');
    }

    await this.prisma.searchHistory.upsert({
      where: { searcherId_searchedId: { searcherId: viewerId, searchedId: userId } },
      create: { searcherId: viewerId, searchedId: userId },
      update: { createdAt: new Date() },
    });

    const overflow = await this.prisma.searchHistory.findMany({
      where: { searcherId: viewerId },
      orderBy: { createdAt: 'desc' },
      skip: SEARCH_HISTORY_MAX,
      select: { searchedId: true },
    });
    if (overflow.length > 0) {
      await this.prisma.searchHistory.deleteMany({
        where: { searcherId: viewerId, searchedId: { in: overflow.map((o) => o.searchedId) } },
      });
    }
  }

  async removeFromHistory(viewerId: string, userId: string): Promise<void> {
    await this.prisma.searchHistory.deleteMany({
      where: { searcherId: viewerId, searchedId: userId },
    });
  }

  async clearHistory(viewerId: string): Promise<void> {
    await this.prisma.searchHistory.deleteMany({ where: { searcherId: viewerId } });
  }
}
