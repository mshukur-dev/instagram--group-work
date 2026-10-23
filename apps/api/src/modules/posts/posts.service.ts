import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ErrorCode,
  POST_VIDEO_MAX_SECONDS,
  REEL_MAX_SECONDS,
  type CreatePostInput,
  type Post,
  type PostType,
  type UpdatePostInput,
} from '@instagram/shared';
import { forbidden, notFound } from '../../common/errors/app-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { upsertLocation } from './locations';
import { FollowsService } from '../follows/follows.service';
import { MediaService } from '../media/media.service';
import {
  NotificationsService,
  type NotificationInput,
} from '../notifications/notifications.service';
import { UserPreviewService, userPreviewSelect } from '../users/user-preview.service';
import { parseHashtags, parseMentions } from './caption';
import { attachHashtags, detachHashtags } from './hashtags';
import { postInclude, postUsers, toPostDto, type PostRow } from './posts.mapper';

/** Minimal post data returned by access checks (used by likes and comments too). */
export type AccessiblePost = {
  id: string;
  authorId: string;
  type: PostType;
  commentsDisabled: boolean;
};

const accessibleSelect = {
  id: true,
  authorId: true,
  type: true,
  commentsDisabled: true,
} satisfies Prisma.PostSelect;

/**
 * Posts and reels: create / read / edit / delete, access checks and the one
 * post mapper used everywhere (feeds, profile grids, DM shares).
 */
@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly follows: FollowsService,
    private readonly userPreview: UserPreviewService,
    private readonly media: MediaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────── Access & mapping (shared with feed, likes, comments) ─────────────

  /**
   * The post if the viewer may see it: 404 POST_NOT_FOUND when it doesn't exist
   * or a block hides it, 403 PRIVATE_ACCOUNT when the author is private and not followed.
   */
  async getAccessible(viewerId: string, postId: string): Promise<AccessiblePost> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: accessibleSelect,
    });
    if (!post) throw postNotFound();
    if (!(await this.follows.canViewContent(viewerId, post.authorId))) {
      if (await this.follows.isBlockedBetween(viewerId, post.authorId)) throw postNotFound();
      throw forbidden(ErrorCode.PRIVATE_ACCOUNT, 'This account is private.');
    }
    return post;
  }

  /**
   * Prisma filter for posts the viewer may see in lists: own posts, posts of
   * accepted followings and of public accounts, never of blocked users.
   */
  async visibleWhere(viewerId: string): Promise<Prisma.PostWhereInput> {
    const [followingIds, blockedIds] = await Promise.all([
      this.follows.getFollowingIds(viewerId),
      this.follows.getBlockedUserIds(viewerId),
    ]);
    return {
      authorId: { notIn: blockedIds },
      OR: [{ authorId: { in: [viewerId, ...followingIds] } }, { author: { isPrivate: false } }],
    };
  }

  /** Maps rows loaded with `postInclude`, with all per-viewer flags in a few batch queries. */
  async mapPosts(viewerId: string, rows: PostRow[]): Promise<Post[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [likes, saves, blockedIds, likers] = await Promise.all([
      this.prisma.like.findMany({
        where: { userId: viewerId, postId: { in: ids } },
        select: { postId: true },
      }),
      this.prisma.savedPost.findMany({
        where: { userId: viewerId, postId: { in: ids } },
        select: { postId: true },
      }),
      this.follows.getBlockedUserIds(viewerId),
      this.likedByPreview(viewerId, ids),
    ]);
    const previews = await this.userPreview.build(viewerId, [
      ...rows.flatMap(postUsers),
      ...likers.users,
    ]);
    const ctx = {
      likedIds: new Set(likes.map((l) => l.postId)),
      savedIds: new Set(saves.map((s) => s.postId)),
      blockedIds: new Set(blockedIds),
      previews,
      likedBy: likers.byPost,
    };
    return rows.map((row) => toPostDto(row, ctx));
  }

  /**
   * Up to 3 likers per post for "Liked by maria and 5 others": people the viewer follows first,
   * then the most recent. One query for the whole page (a window function per post); the viewer
   * and blocked users are left out.
   */
  private async likedByPreview(viewerId: string, postIds: string[]) {
    const [followingIds, blockedIds] = await Promise.all([
      this.follows.getFollowingIds(viewerId),
      this.follows.getBlockedUserIds(viewerId),
    ]);
    const rows = await this.prisma.$queryRaw<{ postId: string; userId: string }[]>`
      SELECT "postId", "userId" FROM (
        SELECT l."postId", l."userId",
          ROW_NUMBER() OVER (
            PARTITION BY l."postId"
            ORDER BY (l."userId" = ANY(${followingIds}::text[])) DESC, l."createdAt" DESC
          ) AS rank
        FROM "likes" l
        WHERE l."postId" = ANY(${postIds}::text[])
          AND l."userId" <> ${viewerId}
          AND NOT (l."userId" = ANY(${blockedIds}::text[]))
      ) ranked
      WHERE rank <= 3
      ORDER BY "postId", rank`;

    const byPost = new Map<string, string[]>();
    for (const row of rows) byPost.set(row.postId, [...(byPost.get(row.postId) ?? []), row.userId]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
      select: userPreviewSelect,
    });
    return { byPost, users };
  }

  /**
   * CONTRACT (docs/spec/backend.md §2.1) — used by messages for shared posts.
   * Posts the viewer can't see (private / blocked / deleted) are omitted from the map.
   */
  async getByIds(viewerId: string, ids: string[]): Promise<Map<string, Post>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.prisma.post.findMany({
      where: { AND: [{ id: { in: unique } }, await this.visibleWhere(viewerId)] },
      include: postInclude,
    });
    const posts = await this.mapPosts(viewerId, rows);
    return new Map(posts.map((p) => [p.id, p]));
  }

  // ───────────── CRUD ─────────────

  async create(authorId: string, dto: CreatePostInput): Promise<Post> {
    this.media.assertUploaded(dto.media, {
      folders: ['posts', 'reels'],
      maxVideoSeconds: dto.type === 'REEL' ? REEL_MAX_SECONDS : POST_VIDEO_MAX_SECONDS,
    });
    const caption = dto.caption ? dto.caption : null;
    const taggedIds = await this.allowedUserIds(authorId, dto.taggedUserIds ?? []);
    const hashtags = parseHashtags(caption);

    const post = await this.prisma.$transaction(async (tx) => {
      const locationId = dto.location ? await upsertLocation(tx, dto.location) : null;
      const created = await tx.post.create({
        data: {
          authorId,
          locationId,
          type: dto.type,
          caption,
          media: {
            create: dto.media.map((m, order) => ({
              type: m.type,
              url: m.url,
              publicId: m.publicId,
              width: m.width,
              height: m.height,
              duration: m.duration ?? null,
              thumbnailUrl: m.thumbnailUrl ?? null,
              order,
            })),
          },
          tags: { create: taggedIds.map((userId) => ({ userId })) },
        },
        select: { id: true },
      });
      await tx.user.update({ where: { id: authorId }, data: { postsCount: { increment: 1 } } });
      await attachHashtags(tx, created.id, hashtags);
      return created;
    });

    // side effects after the write
    const tagged = new Set(taggedIds);
    this.notify(
      taggedIds.map((recipientId) => ({
        recipientId,
        actorId: authorId,
        type: 'POST_TAG',
        postId: post.id,
      })),
    );
    await this.notifyMentions(authorId, post.id, parseMentions(caption), tagged);

    return this.getOne(authorId, post.id);
  }

  async getOne(viewerId: string, postId: string): Promise<Post> {
    await this.getAccessible(viewerId, postId);
    const row = await this.prisma.post.findUniqueOrThrow({
      where: { id: postId },
      include: postInclude,
    });
    const [post] = await this.mapPosts(viewerId, [row]);
    if (!post) throw postNotFound();
    return post;
  }

  async update(viewerId: string, postId: string, dto: UpdatePostInput): Promise<Post> {
    const post = await this.getAccessible(viewerId, postId);
    if (post.authorId !== viewerId) {
      throw forbidden(ErrorCode.FORBIDDEN, 'You can only edit your own posts.');
    }

    const current = await this.prisma.post.findUniqueOrThrow({
      where: { id: postId },
      select: {
        caption: true,
        hashtags: { select: { hashtag: { select: { id: true, name: true } } } },
      },
    });
    const captionChanged = dto.caption !== undefined;
    const caption = captionChanged ? dto.caption || null : current.caption;

    await this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        data: {
          ...(captionChanged ? { caption } : {}),
          ...(dto.commentsDisabled !== undefined ? { commentsDisabled: dto.commentsDisabled } : {}),
          ...(dto.location !== undefined
            ? { locationId: dto.location ? await upsertLocation(tx, dto.location) : null }
            : {}),
        },
      });
      if (!captionChanged) return;
      const next = parseHashtags(caption);
      const existing = current.hashtags.map((h) => h.hashtag);
      const removed = existing.filter((h) => !next.includes(h.name)).map((h) => h.id);
      const added = next.filter((name) => !existing.some((h) => h.name === name));
      await detachHashtags(tx, postId, removed);
      await attachHashtags(tx, postId, added);
    });

    if (captionChanged) {
      // only people mentioned for the first time get a notification
      const before = new Set(parseMentions(current.caption));
      const fresh = parseMentions(caption).filter((u) => !before.has(u));
      await this.notifyMentions(viewerId, postId, fresh, new Set());
    }
    return this.getOne(viewerId, postId);
  }

  async remove(viewerId: string, postId: string): Promise<void> {
    const post = await this.getAccessible(viewerId, postId);
    if (post.authorId !== viewerId) {
      throw forbidden(ErrorCode.FORBIDDEN, 'You can only delete your own posts.');
    }
    const [media, links] = await Promise.all([
      this.prisma.postMedia.findMany({ where: { postId }, select: { publicId: true } }),
      this.prisma.postHashtag.findMany({ where: { postId }, select: { hashtagId: true } }),
    ]);

    await this.prisma.$transaction(async (tx) => {
      await detachHashtags(
        tx,
        postId,
        links.map((l) => l.hashtagId),
      );
      // deleteMany: a concurrent delete of the same post is a no-op, not a 500
      const { count } = await tx.post.deleteMany({ where: { id: postId } });
      if (count === 0) throw postNotFound();
      await tx.user.update({ where: { id: viewerId }, data: { postsCount: { decrement: 1 } } });
    });

    this.media.destroy(media.map((m) => m.publicId));
  }

  /** +1 view of a reel (REELS-5). The author's own views and regular posts are not counted. */
  async view(viewerId: string, postId: string): Promise<void> {
    const post = await this.getAccessible(viewerId, postId);
    if (post.type !== 'REEL' || post.authorId === viewerId) return;
    await this.prisma.post.update({
      where: { id: postId },
      data: { viewsCount: { increment: 1 } },
    });
  }

  // ───────────── Helpers ─────────────

  /** Keeps ids of existing users without a block between them and the actor. */
  async allowedUserIds(actorId: string, ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const [users, blockedIds] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true } }),
      this.follows.getBlockedUserIds(actorId),
    ]);
    const blocked = new Set(blockedIds);
    const existing = new Set(users.map((u) => u.id));
    return unique.filter((id) => existing.has(id) && !blocked.has(id));
  }

  /**
   * Ids of users mentioned as `@username` that may be notified by the actor:
   * existing, not the actor, no block in either direction. Used by comments too.
   */
  async mentionedUserIds(actorId: string, usernames: string[]): Promise<string[]> {
    if (usernames.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { username: { in: usernames } },
      select: { id: true },
    });
    const allowed = await this.allowedUserIds(
      actorId,
      users.map((u) => u.id),
    );
    return allowed.filter((id) => id !== actorId);
  }

  /** MENTION notifications for `@username`s in a caption (skips users in `skip`). */
  private async notifyMentions(
    actorId: string,
    postId: string,
    usernames: string[],
    skip: ReadonlySet<string>,
  ): Promise<void> {
    const ids = await this.mentionedUserIds(actorId, usernames);
    this.notify(
      ids
        .filter((id) => !skip.has(id))
        .map((recipientId) => ({ recipientId, actorId, type: 'MENTION', postId })),
    );
  }

  /** Fire-and-forget: NotificationsService skips self-notifications and never throws. */
  private notify(inputs: NotificationInput[]): void {
    for (const input of inputs) {
      if (input.recipientId !== input.actorId) void this.notifications.create(input);
    }
  }
}

export const postNotFound = () => notFound(ErrorCode.POST_NOT_FOUND, 'Post not found.');
