import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ErrorCode,
  type Location,
  type Place,
  type Hashtag,
  type Page,
  type PageQuery,
  type Post,
  type PostType,
  TOP_REEL_MIN_VIEWS,
} from '@instagram/shared';
import { forbidden, notFound } from '../../common/errors/app-exception';
import { cursorArgs, toPageBy } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowsService } from '../follows/follows.service';
import { normalizeHashtag } from './caption';
import { searchPlaces } from './locations';
import { postInclude, type PostRow } from './posts.mapper';
import { PostsService } from './posts.service';

/** Explore shows posts of the last N days (falls back to all time when there are none). */
export const EXPLORE_DAYS = 7;

const newestFirst: Prisma.PostOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

/**
 * Lists of posts: feed, reels, explore, hashtag pages and profile grids.
 * Every list is cursor-paginated by post id with a stable order.
 */
@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly follows: FollowsService,
    private readonly posts: PostsService,
  ) {}

  /** FEED-1: type POST from accepted followings + my own, newest first. */
  async feed(viewerId: string, query: PageQuery): Promise<Page<Post>> {
    const followingIds = await this.follows.getFollowingIds(viewerId);
    return this.page(viewerId, query, {
      type: 'POST',
      authorId: { in: [viewerId, ...followingIds] },
    });
  }

  /** REELS-2: every reel the viewer may see (public accounts + followed + own), newest first. */
  async reels(viewerId: string, query: PageQuery): Promise<Page<Post>> {
    return this.page(viewerId, query, {
      AND: [{ type: 'REEL' }, await this.posts.visibleWhere(viewerId)],
    });
  }

  /**
   * SEARCH-4: posts and reels of public accounts the viewer doesn't follow
   * (and isn't waiting for), last EXPLORE_DAYS days, most liked first.
   * If there is nothing recent, falls back to all time so the grid is never empty.
   */
  async explore(viewerId: string, query: PageQuery): Promise<Page<Post>> {
    const [follows, blockedIds] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: viewerId },
        select: { followingId: true },
      }),
      this.follows.getBlockedUserIds(viewerId),
    ]);
    const base: Prisma.PostWhereInput = {
      authorId: { notIn: [viewerId, ...follows.map((f) => f.followingId), ...blockedIds] },
      author: { isPrivate: false },
    };
    const since = new Date(Date.now() - EXPLORE_DAYS * 24 * 60 * 60 * 1000);
    const recent = await this.prisma.post.findFirst({
      where: { ...base, createdAt: { gte: since } },
      select: { id: true },
    });
    const where = recent ? { ...base, createdAt: { gte: since } } : base;
    return this.page(viewerId, query, where, [
      { likesCount: 'desc' },
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  }

  /**
   * SEARCH-4 "Top": the popular posts and reels the viewer may see, a mix like Instagram's
   * grid. A reel needs TOP_REEL_MIN_VIEWS views to get in; most liked first. Unlike explore,
   * followed accounts and my own posts are included.
   */
  async exploreTop(viewerId: string, query: PageQuery): Promise<Page<Post>> {
    return this.page(
      viewerId,
      query,
      {
        AND: [
          {
            OR: [
              { type: 'POST' },
              { type: 'REEL', viewsCount: { gte: TOP_REEL_MIN_VIEWS } },
            ],
          },
          await this.posts.visibleWhere(viewerId),
        ],
      },
      [{ likesCount: 'desc' }, { viewsCount: 'desc' }, { id: 'desc' }],
    );
  }

  /** Unknown hashtags return postsCount 0 (an empty tag page), not 404. */
  /**
   * The hashtag page header. The count is of the posts this viewer can see, so it matches the
   * grid below (private accounts and blocked people are left out), like a place page.
   */
  async hashtag(viewerId: string, name: string): Promise<Hashtag> {
    const normalized = normalizeHashtag(name);
    const postsCount = await this.prisma.post.count({
      where: {
        AND: [
          { hashtags: { some: { hashtag: { name: normalized } } } },
          await this.posts.visibleWhere(viewerId),
        ],
      },
    });
    return { name: normalized, postsCount };
  }

  async hashtagPosts(viewerId: string, name: string, query: PageQuery): Promise<Page<Post>> {
    return this.page(viewerId, query, {
      AND: [
        { hashtags: { some: { hashtag: { name: normalizeHashtag(name) } } } },
        await this.posts.visibleWhere(viewerId),
      ],
    });
  }

  // ───────────── Locations ─────────────

  async searchLocations(viewerId: string, q: string): Promise<Place[]> {
    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { language: true },
    });
    return searchPlaces(q, viewer?.language !== 'RU');
  }

  /** A place's page header; the count is of the posts this viewer may see */
  async location(viewerId: string, id: string): Promise<Location> {
    const row = await this.prisma.location.findUnique({
      where: { id },
      select: { id: true, name: true, address: true, lat: true, lng: true },
    });
    if (!row) throw notFound(ErrorCode.NOT_FOUND, 'Location not found.');
    const postsCount = await this.prisma.post.count({
      where: { AND: [{ locationId: id }, await this.posts.visibleWhere(viewerId)] },
    });
    return { ...row, postsCount };
  }

  async locationPosts(viewerId: string, id: string, query: PageQuery): Promise<Page<Post>> {
    return this.page(viewerId, query, {
      AND: [{ locationId: id }, await this.posts.visibleWhere(viewerId)],
    });
  }

  // ───────────── Profile grids ─────────────

  async userPosts(
    viewerId: string,
    username: string,
    type: PostType,
    query: PageQuery,
  ): Promise<Page<Post>> {
    const ownerId = await this.resolveOwner(viewerId, username);
    return this.page(viewerId, query, { authorId: ownerId, type });
  }

  /** Posts where the user is tagged, only those the viewer may see. */
  async taggedPosts(viewerId: string, username: string, query: PageQuery): Promise<Page<Post>> {
    const ownerId = await this.resolveOwner(viewerId, username);
    return this.page(viewerId, query, {
      AND: [{ tags: { some: { userId: ownerId } } }, await this.posts.visibleWhere(viewerId)],
    });
  }

  /** Only the owner sees their saved posts; cursor = post id, newest save first. */
  async saved(viewerId: string, query: PageQuery): Promise<Page<Post>> {
    const rows = await this.prisma.savedPost.findMany({
      where: { userId: viewerId, post: await this.posts.visibleWhere(viewerId) },
      orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor
        ? { skip: 1, cursor: { userId_postId: { userId: viewerId, postId: query.cursor } } }
        : {}),
      include: { post: { include: postInclude } },
    });
    const page = toPageBy(
      rows,
      query.limit,
      (r) => r.postId,
      (r) => r.post,
    );
    return { items: await this.posts.mapPosts(viewerId, page.items), nextCursor: page.nextCursor };
  }

  /**
   * Profile owner id for /users/:username/... ('me' = the viewer).
   * 404 USER_NOT_FOUND for missing or blocked users, 403 PRIVATE_ACCOUNT for closed profiles.
   */
  private async resolveOwner(viewerId: string, username: string): Promise<string> {
    if (username === 'me') return viewerId;
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (!user || (await this.follows.isBlockedBetween(viewerId, user.id))) {
      throw notFound(ErrorCode.USER_NOT_FOUND, 'User not found.');
    }
    if (!(await this.follows.canViewContent(viewerId, user.id))) {
      throw forbidden(ErrorCode.PRIVATE_ACCOUNT, 'This account is private.');
    }
    return user.id;
  }

  private async page(
    viewerId: string,
    query: PageQuery,
    where: Prisma.PostWhereInput,
    orderBy: Prisma.PostOrderByWithRelationInput[] = newestFirst,
  ): Promise<Page<Post>> {
    const rows: PostRow[] = await this.prisma.post.findMany({
      where,
      orderBy,
      include: postInclude,
      ...cursorArgs(query),
    });
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: await this.posts.mapPosts(viewerId, pageRows),
      nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
    };
  }
}
