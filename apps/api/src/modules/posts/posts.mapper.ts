import type { Prisma } from '@prisma/client';
import type { Post, PostMedia, UserPreview } from '@instagram/shared';
import { userPreviewSelect, type UserPreviewRow } from '../users/user-preview.service';

/** Everything needed to build a Post DTO. Use in every post query: `include: postInclude`. */
export const postInclude = {
  author: { select: userPreviewSelect },
  media: { orderBy: { order: 'asc' } },
  tags: { select: { user: { select: userPreviewSelect } } },
} satisfies Prisma.PostInclude;

export type PostRow = Prisma.PostGetPayload<{ include: typeof postInclude }>;

/** Per-viewer data loaded in batches for a list of posts (see PostsService.mapPosts). */
export type PostViewerContext = {
  likedIds: ReadonlySet<string>;
  savedIds: ReadonlySet<string>;
  /** Users blocked between the viewer and them: hidden from taggedUsers */
  blockedIds: ReadonlySet<string>;
  previews: ReadonlyMap<string, UserPreview>;
};

export function postUsers(row: PostRow): UserPreviewRow[] {
  return [row.author, ...row.tags.map((t) => t.user)];
}

function toPreview(user: UserPreviewRow, ctx: PostViewerContext): UserPreview {
  return (
    ctx.previews.get(user.id) ?? {
      ...user,
      hasActiveStory: false,
      hasUnseenStory: false,
    }
  );
}

export function toPostMediaDto(media: PostRow['media'][number]): PostMedia {
  return {
    id: media.id,
    type: media.type,
    url: media.url,
    width: media.width,
    height: media.height,
    duration: media.duration,
    thumbnailUrl: media.thumbnailUrl,
  };
}

export function toPostDto(row: PostRow, ctx: PostViewerContext): Post {
  return {
    id: row.id,
    type: row.type,
    author: toPreview(row.author, ctx),
    caption: row.caption,
    media: row.media.map(toPostMediaDto),
    taggedUsers: row.tags
      .filter((t) => !ctx.blockedIds.has(t.user.id))
      .map((t) => toPreview(t.user, ctx)),
    likesCount: row.likesCount,
    commentsCount: row.commentsCount,
    viewsCount: row.viewsCount,
    isLiked: ctx.likedIds.has(row.id),
    isSaved: ctx.savedIds.has(row.id),
    commentsDisabled: row.commentsDisabled,
    createdAt: row.createdAt.toISOString(),
  };
}
