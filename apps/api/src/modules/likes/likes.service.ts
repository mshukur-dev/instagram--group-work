import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { FilteredPageQuery, LikesCount, Page, UserListItem } from '@instagram/shared';
import { toPageBy } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { commentNotFound, CommentsService } from '../comments/comments.service';
import { FollowsService } from '../follows/follows.service';
import { NotificationsService } from '../notifications/notifications.service';
import { postNotFound, PostsService } from '../posts/posts.service';
import { userPreviewSelect, UserPreviewService } from '../users/user-preview.service';

/**
 * Likes and saves. All operations are idempotent: liking twice keeps one like
 * and returns the current count (docs/spec/backend.md §3.6).
 * Liking / saving needs access to the post; undoing only needs it to exist,
 * so a user can always clean up after an account went private or blocked them.
 */
@Injectable()
export class LikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly follows: FollowsService,
    private readonly userPreview: UserPreviewService,
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────── Post likes ─────────────

  async likePost(userId: string, postId: string): Promise<LikesCount> {
    const post = await this.posts.getAccessible(userId, postId);
    const { created, likesCount } = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.like.createMany({
        data: [{ userId, postId }],
        skipDuplicates: true,
      });
      const row = count
        ? await tx.post.update({
            where: { id: postId },
            data: { likesCount: { increment: 1 } },
            select: { likesCount: true },
          })
        : await tx.post.findUniqueOrThrow({ where: { id: postId }, select: { likesCount: true } });
      return { created: count > 0, likesCount: row.likesCount };
    });
    if (created && post.authorId !== userId) {
      void this.notifications.create({
        recipientId: post.authorId,
        actorId: userId,
        type: 'POST_LIKE',
        postId,
      });
    }
    return { likesCount };
  }

  async unlikePost(userId: string, postId: string): Promise<LikesCount> {
    const post = await this.existingPost(postId);
    const { removed, likesCount } = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.like.deleteMany({ where: { userId, postId } });
      const row = count
        ? await tx.post.update({
            where: { id: postId },
            data: { likesCount: { decrement: 1 } },
            select: { likesCount: true },
          })
        : await tx.post.findUniqueOrThrow({ where: { id: postId }, select: { likesCount: true } });
      return { removed: count > 0, likesCount: row.likesCount };
    });
    if (removed && post.authorId !== userId) {
      void this.notifications.remove({
        recipientId: post.authorId,
        actorId: userId,
        type: 'POST_LIKE',
        postId,
      });
    }
    return { likesCount };
  }

  /** ENGAGE-7: who liked the post, newest first; `q` filters by username / full name. */
  async likers(
    viewerId: string,
    postId: string,
    query: FilteredPageQuery,
  ): Promise<Page<UserListItem>> {
    await this.posts.getAccessible(viewerId, postId);
    const blockedIds = await this.follows.getBlockedUserIds(viewerId);
    const userFilter: Prisma.UserWhereInput | undefined = query.q
      ? {
          OR: [
            { username: { contains: query.q, mode: 'insensitive' } },
            { fullName: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const rows = await this.prisma.like.findMany({
      where: { postId, userId: { notIn: blockedIds }, ...(userFilter ? { user: userFilter } : {}) },
      orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor
        ? { skip: 1, cursor: { userId_postId: { userId: query.cursor, postId } } }
        : {}),
      select: { userId: true, user: { select: userPreviewSelect } },
    });
    const page = toPageBy(
      rows,
      query.limit,
      (r) => r.userId,
      (r) => r.user,
    );
    const ids = page.items.map((u) => u.id);
    const [previews, statuses] = await Promise.all([
      this.userPreview.build(viewerId, page.items),
      this.follows.getFollowStatuses(viewerId, ids),
    ]);
    return {
      items: page.items.map((u) => ({
        ...(previews.get(u.id) ?? this.userPreview.toPreview(u)),
        followStatus: statuses.get(u.id) ?? 'NONE',
        isMe: u.id === viewerId,
      })),
      nextCursor: page.nextCursor,
    };
  }

  // ───────────── Saves ─────────────

  async save(userId: string, postId: string): Promise<void> {
    await this.posts.getAccessible(userId, postId);
    await this.prisma.savedPost.createMany({ data: [{ userId, postId }], skipDuplicates: true });
  }

  async unsave(userId: string, postId: string): Promise<void> {
    await this.existingPost(postId);
    await this.prisma.savedPost.deleteMany({ where: { userId, postId } });
  }

  // ───────────── Comment likes ─────────────

  async likeComment(userId: string, commentId: string): Promise<LikesCount> {
    const comment = await this.comments.getAccessible(userId, commentId);
    const { created, likesCount } = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.commentLike.createMany({
        data: [{ userId, commentId }],
        skipDuplicates: true,
      });
      const row = count
        ? await tx.comment.update({
            where: { id: commentId },
            data: { likesCount: { increment: 1 } },
            select: { likesCount: true },
          })
        : await tx.comment.findUniqueOrThrow({
            where: { id: commentId },
            select: { likesCount: true },
          });
      return { created: count > 0, likesCount: row.likesCount };
    });
    if (created && comment.authorId !== userId) {
      void this.notifications.create({
        recipientId: comment.authorId,
        actorId: userId,
        type: 'COMMENT_LIKE',
        postId: comment.postId,
        commentId,
      });
    }
    return { likesCount };
  }

  async unlikeComment(userId: string, commentId: string): Promise<LikesCount> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true, postId: true },
    });
    if (!comment) throw commentNotFound();
    const { removed, likesCount } = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.commentLike.deleteMany({ where: { userId, commentId } });
      const row = count
        ? await tx.comment.update({
            where: { id: commentId },
            data: { likesCount: { decrement: 1 } },
            select: { likesCount: true },
          })
        : await tx.comment.findUniqueOrThrow({
            where: { id: commentId },
            select: { likesCount: true },
          });
      return { removed: count > 0, likesCount: row.likesCount };
    });
    if (removed && comment.authorId !== userId) {
      void this.notifications.remove({
        recipientId: comment.authorId,
        actorId: userId,
        type: 'COMMENT_LIKE',
        postId: comment.postId,
        commentId,
      });
    }
    return { likesCount };
  }

  private async existingPost(postId: string): Promise<{ authorId: string }> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) throw postNotFound();
    return post;
  }
}
