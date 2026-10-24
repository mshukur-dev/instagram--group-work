import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ErrorCode,
  type Location,
  type Place,
  type Hashtag,
  type FeedQuery,
  type Page,
  type PageQuery,
  type Post,
  type PostType,
  type SearchPostsQuery,
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

/** A refreshed feed looks at the newest posts only, and shuffles them within this many places */
const FEED_SHUFFLE_POOL = 400;
const FEED_SHUFFLE_WINDOW = 40;

/** Small string hash (FNV-1a), enough to spread posts out for a shuffle */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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

  /**
   * FEED-1: type POST from accepted followings + my own, newest first. With a `seed` (sent after
   * a pull to refresh) the order is shuffled: each post moves up or down by up to
   * FEED_SHUFFLE_WINDOW places by a hash of its id and the seed, so fresh posts stay near the top
   * but every refresh lays the rest out differently. The same seed always gives the same order,
   * so the cursor (the last post id) keeps working between pages.
   */
  async feed(viewerId: string, query: FeedQuery): Promise<Page<Post>> {
    const followingIds = await this.follows.getFollowingIds(viewerId);
    const where: Prisma.PostWhereInput = {
      type: 'POST',
      authorId: { in: [viewerId, ...followingIds] },
    };
    if (query.seed === undefined) return this.page(viewerId, query, where);

    const rows = await this.prisma.post.findMany({
      where,
      orderBy: newestFirst,
      select: { id: true },
      take: FEED_SHUFFLE_POOL,
    });
    const seed = query.seed;
    const ranked = rows
      .map((row, i) => ({ id: row.id, key: i + (hash(`${seed}:${row.id}`) % FEED_SHUFFLE_WINDOW) }))
      .sort((a, b) => a.key - b.key || (a.id < b.id ? -1 : 1))
      .map((entry) => entry.id);
    const at = query.cursor ? ranked.indexOf(query.cursor) : -1;
    const start = at + 1;
    const ids = ranked.slice(start, start + query.limit);
    const found = await this.prisma.post.findMany({
      where: { id: { in: ids } },
      include: postInclude,
    });
    const byId = new Map(found.map((row) => [row.id, row]));
    const pageRows = ids.flatMap((id) => byId.get(id) ?? []);
    const hasMore = start + query.limit < ranked.length;
    return {
      items: await this.posts.mapPosts(viewerId, pageRows),
      nextCursor: hasMore ? (ids[ids.length - 1] ?? null) : null,
    };
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
   * SEARCH-4 "Top": popular posts and reels the viewer may see, laid out like Instagram's
   * grid. The page is a run of blocks two rows tall: one reel (a tall tile) and four posts,
   * the reel on the left in even blocks and on the right in odd ones — so reels take a third of
   * the grid all the way down. Reels go by views, posts by likes; when one kind runs out the
   * other fills its places. Followed accounts and my own posts are included.
   *
   * The cursor is "<reels taken>_<posts taken>" (two lists are merged, so one id can't say
   * where both stand).
   */
  async exploreTop(viewerId: string, query: PageQuery): Promise<Page<Post>> {
    const cursor = /^(\d+)_(\d+)$/.exec(query.cursor ?? '');
    const reelsSkip = Number(cursor?.[1] ?? 0);
    const postsSkip = Number(cursor?.[2] ?? 0);
    const visible = await this.posts.visibleWhere(viewerId);
    // Enough of each kind to fill a whole page even if the other kind has nothing left
    const take = query.limit + 1;
    const [reels, posts] = await Promise.all([
      this.prisma.post.findMany({
        where: { AND: [{ type: 'REEL' }, visible] },
        orderBy: [{ viewsCount: 'desc' }, { likesCount: 'desc' }, { id: 'desc' }],
        include: postInclude,
        skip: reelsSkip,
        take,
      }),
      this.prisma.post.findMany({
        where: { AND: [{ type: 'POST' }, visible] },
        orderBy: [{ likesCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        include: postInclude,
        skip: postsSkip,
        take,
      }),
    ]);

    const page: PostRow[] = [];
    let r = 0;
    let p = 0;
    const next = (wantReel: boolean) => {
      const reel = reels[r];
      const post = posts[p];
      if ((wantReel && reel) || !post) {
        if (!reel) return;
        page.push(reel);
        r += 1;
        return;
      }
      page.push(post);
      p += 1;
    };
    for (
      let block = 0;
      page.length < query.limit && (r < reels.length || p < posts.length);
      block++
    ) {
      // Even block: reel first (left column); odd block: two posts, then the reel (right)
      const shape =
        block % 2 === 0 ? [true, false, false, false, false] : [false, false, true, false, false];
      for (const wantReel of shape) {
        if (page.length >= query.limit) break;
        next(wantReel);
      }
    }

    const hasMore = r < reels.length || p < posts.length;
    return {
      items: await this.posts.mapPosts(viewerId, page),
      nextCursor: hasMore ? `${reelsSkip + r}_${postsSkip + p}` : null,
    };
  }

  /**
   * The hashtag page header (an unknown hashtag is an empty page, not 404). The count is of the posts this viewer can see, so it matches the
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

  // ───────────── Search (SEARCH-5) ─────────────

  /**
   * Posts or reels whose caption has the words, or that carry a hashtag starting with them;
   * only what the viewer may see, most liked first.
   */
  async searchPosts(viewerId: string, query: SearchPostsQuery): Promise<Page<Post>> {
    const tag = normalizeHashtag(query.q);
    return this.page(
      viewerId,
      query,
      {
        AND: [
          query.type ? { type: query.type } : {},
          {
            OR: [
              { caption: { contains: query.q, mode: 'insensitive' } },
              ...(tag ? [{ hashtags: { some: { hashtag: { name: { startsWith: tag } } } } }] : []),
            ],
          },
          await this.posts.visibleWhere(viewerId),
        ],
      },
      [{ likesCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    );
  }

  /**
   * Places people posted from (not the whole map: that's the "Add location" search), by name
   * or address. Each counts the posts this viewer may see; places with none are left out.
   */
  async searchPlaces(viewerId: string, q: string, limit: number): Promise<Location[]> {
    const rows = await this.prisma.location.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, address: true, lat: true, lng: true },
      take: 50,
    });
    const visible = await this.posts.visibleWhere(viewerId);
    const counted = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        postsCount: await this.prisma.post.count({
          where: { AND: [{ locationId: row.id }, visible] },
        }),
      })),
    );
    return counted
      .filter((place) => place.postsCount > 0)
      .sort((a, b) => b.postsCount - a.postsCount)
      .slice(0, limit);
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
