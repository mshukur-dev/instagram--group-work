import type { Prisma } from '@prisma/client';
import type { Comment, UserPreview } from '@instagram/shared';
import { userPreviewSelect } from '../users/user-preview.service';

export const commentInclude = {
  author: { select: userPreviewSelect },
} satisfies Prisma.CommentInclude;

export type CommentRow = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

export type CommentViewerContext = {
  likedIds: ReadonlySet<string>;
  previews: ReadonlyMap<string, UserPreview>;
};

export function toCommentDto(row: CommentRow, ctx: CommentViewerContext): Comment {
  return {
    id: row.id,
    postId: row.postId,
    text: row.text,
    author: ctx.previews.get(row.author.id) ?? {
      ...row.author,
      hasActiveStory: false,
      hasUnseenStory: false,
    },
    parentId: row.parentId,
    likesCount: row.likesCount,
    repliesCount: row.repliesCount,
    isLiked: ctx.likedIds.has(row.id),
    createdAt: row.createdAt.toISOString(),
  };
}
