import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ErrorCode,
  type Comment,
  type CreateCommentInput,
  type Page,
  type PageQuery,
} from '@instagram/shared';
import { forbidden, notFound } from '../../common/errors/app-exception';
import { cursorArgs, toPage } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowsService } from '../follows/follows.service';
import {
  NotificationsService,
  type NotificationInput,
} from '../notifications/notifications.service';
import { UserPreviewService } from '../users/user-preview.service';
import { parseMentions } from '../posts/caption';
import { PostsService, type AccessiblePost } from '../posts/posts.service';
import { commentInclude, toCommentDto, type CommentRow } from './comments.mapper';

export type AccessibleComment = {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  post: AccessiblePost;
};

export const commentNotFound = () => notFound(ErrorCode.COMMENT_NOT_FOUND, 'Comment not found.');

/**
 * Comments with one level of replies (ENGAGE-2/3/5).
 * Replying to a reply attaches the new comment to the same top-level comment
 * (like Instagram), so the tree never gets deeper than one level.
 * Top-level comments: newest first. Replies: oldest first (reads as a conversation).
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly follows: FollowsService,
    private readonly userPreview: UserPreviewService,
    private readonly posts: PostsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The comment if the viewer may see its post (404 COMMENT_NOT_FOUND / post errors). */
  async getAccessible(viewerId: string, commentId: string): Promise<AccessibleComment> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, authorId: true, parentId: true },
    });
    if (!comment) throw commentNotFound();
    if (await this.follows.isBlockedBetween(viewerId, comment.authorId)) throw commentNotFound();
    const post = await this.posts.getAccessible(viewerId, comment.postId);
    return { ...comment, post };
  }

  async list(viewerId: string, postId: string, query: PageQuery): Promise<Page<Comment>> {
    await this.posts.getAccessible(viewerId, postId);
    return this.page(viewerId, query, { postId, parentId: null }, [
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  }

  async replies(viewerId: string, commentId: string, query: PageQuery): Promise<Page<Comment>> {
    await this.getAccessible(viewerId, commentId);
    return this.page(viewerId, query, { parentId: commentId }, [
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
  }

  async create(viewerId: string, postId: string, dto: CreateCommentInput): Promise<Comment> {
    const post = await this.posts.getAccessible(viewerId, postId);
    if (post.commentsDisabled) {
      throw forbidden(ErrorCode.COMMENTS_DISABLED, 'Comments on this post have been limited.');
    }

    let parent: { id: string; authorId: string; rootId: string } | null = null;
    if (dto.parentId) {
      const row = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: { id: true, postId: true, parentId: true, authorId: true },
      });
      if (!row || row.postId !== postId) throw commentNotFound();
      parent = { id: row.id, authorId: row.authorId, rootId: row.parentId ?? row.id };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: { postId, authorId: viewerId, text: dto.text, parentId: parent?.rootId ?? null },
        include: commentInclude,
      });
      await tx.post.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });
      if (parent) {
        await tx.comment.update({
          where: { id: parent.rootId },
          data: { repliesCount: { increment: 1 } },
        });
      }
      return comment;
    });

    // side effects: one notification per person, most specific type wins
    const inputs = await this.notificationsFor(viewerId, {
      commentId: created.id,
      postId,
      postAuthorId: post.authorId,
      parentAuthorId: parent?.authorId ?? null,
      text: dto.text,
    });
    for (const input of inputs) void this.notifications.create(input);

    const [comment] = await this.mapComments(viewerId, [created]);
    if (!comment) throw commentNotFound();
    return comment;
  }

  /** ENGAGE-5: the comment author or the post author may delete. Replies go with their parent. */
  async remove(viewerId: string, commentId: string): Promise<void> {
    await this.removeWhere(commentId, (comment) => {
      if (comment.authorId !== viewerId && comment.post.authorId !== viewerId) {
        throw forbidden(ErrorCode.FORBIDDEN, "You can't delete this comment.");
      }
    });
  }

  /** ADMIN-5: deletes anyone's comment. Returns what was deleted, for the log. */
  async removeAsAdmin(commentId: string): Promise<{ authorId: string; text: string }> {
    return this.removeWhere(commentId, () => undefined);
  }

  private async removeWhere(
    commentId: string,
    assertAllowed: (comment: { authorId: string; post: { authorId: string } }) => void,
  ): Promise<{ authorId: string; text: string }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        postId: true,
        authorId: true,
        parentId: true,
        text: true,
        post: { select: { authorId: true } },
        parent: { select: { authorId: true } },
      },
    });
    if (!comment) throw commentNotFound();
    assertAllowed(comment);

    const deleted = await this.prisma.$transaction(async (tx) => {
      const replies = comment.parentId
        ? 0
        : await tx.comment.count({ where: { parentId: comment.id } });
      // deleteMany: a concurrent delete of the same comment is a no-op, not a 500
      const { count } = await tx.comment.deleteMany({ where: { id: comment.id } });
      if (count === 0) return false;
      await tx.post.update({
        where: { id: comment.postId },
        data: { commentsCount: { decrement: 1 + replies } },
      });
      if (comment.parentId) {
        await tx.comment.update({
          where: { id: comment.parentId },
          data: { repliesCount: { decrement: 1 } },
        });
      }
      return true;
    });
    const result = { authorId: comment.authorId, text: comment.text };
    if (!deleted) return result;

    const inputs = await this.notificationsFor(comment.authorId, {
      commentId: comment.id,
      postId: comment.postId,
      postAuthorId: comment.post.authorId,
      parentAuthorId: comment.parent?.authorId ?? null,
      text: comment.text,
    });
    for (const input of inputs) void this.notifications.remove(input);
    return result;
  }

  /** Maps rows loaded with `commentInclude`, isLiked and previews in batch queries. */
  async mapComments(viewerId: string, rows: CommentRow[]): Promise<Comment[]> {
    if (rows.length === 0) return [];
    const [likes, previews] = await Promise.all([
      this.prisma.commentLike.findMany({
        where: { userId: viewerId, commentId: { in: rows.map((r) => r.id) } },
        select: { commentId: true },
      }),
      this.userPreview.build(
        viewerId,
        rows.map((r) => r.author),
      ),
    ]);
    const ctx = { likedIds: new Set(likes.map((l) => l.commentId)), previews };
    return rows.map((row) => toCommentDto(row, ctx));
  }

  /**
   * COMMENT_REPLY to the replied-to author, COMMENT to the post author, MENTION to
   * `@username`s — each person once, never the actor, never across a block.
   */
  private async notificationsFor(
    actorId: string,
    c: {
      commentId: string;
      postId: string;
      postAuthorId: string;
      parentAuthorId: string | null;
      text: string;
    },
  ): Promise<NotificationInput[]> {
    const candidates: NotificationInput[] = [];
    const base = { actorId, postId: c.postId, commentId: c.commentId };
    if (c.parentAuthorId) {
      candidates.push({ ...base, recipientId: c.parentAuthorId, type: 'COMMENT_REPLY' });
    }
    candidates.push({ ...base, recipientId: c.postAuthorId, type: 'COMMENT' });
    const mentioned = await this.posts.mentionedUserIds(actorId, parseMentions(c.text));
    for (const recipientId of mentioned) {
      candidates.push({ ...base, recipientId, type: 'MENTION' });
    }

    const allowed = new Set(
      await this.posts.allowedUserIds(
        actorId,
        candidates.map((n) => n.recipientId),
      ),
    );
    const seen = new Set<string>([actorId]);
    return candidates.filter((n) => {
      if (seen.has(n.recipientId) || !allowed.has(n.recipientId)) return false;
      seen.add(n.recipientId);
      return true;
    });
  }

  private async page(
    viewerId: string,
    query: PageQuery,
    where: Prisma.CommentWhereInput,
    orderBy: Prisma.CommentOrderByWithRelationInput[],
  ): Promise<Page<Comment>> {
    const blockedIds = await this.follows.getBlockedUserIds(viewerId);
    const rows = await this.prisma.comment.findMany({
      where: { ...where, authorId: { notIn: blockedIds } },
      orderBy,
      include: commentInclude,
      ...cursorArgs(query),
    });
    const page = toPage(rows, query.limit, (r) => r);
    return { items: await this.mapComments(viewerId, page.items), nextCursor: page.nextCursor };
  }
}
