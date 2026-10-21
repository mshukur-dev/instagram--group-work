import type { Prisma } from '@prisma/client';
import type { Highlight, Story, UserPreview } from '@instagram/shared';
import { userPreviewSelect } from '../users/user-preview.service';

/** Story columns needed to build a Story DTO. */
export const storySelect = {
  id: true,
  authorId: true,
  mediaType: true,
  url: true,
  thumbnailUrl: true,
  duration: true,
  viewsCount: true,
  createdAt: true,
  expiresAt: true,
  author: { select: userPreviewSelect },
} satisfies Prisma.StorySelect;

export type StoryRow = Prisma.StoryGetPayload<{ select: typeof storySelect }>;

export function toStoryDto(
  row: StoryRow,
  viewerId: string,
  author: UserPreview,
  view: { liked: boolean } | undefined,
): Story {
  const isAuthor = row.authorId === viewerId;
  return {
    id: row.id,
    author,
    mediaType: row.mediaType,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl,
    duration: row.duration,
    isSeen: view !== undefined,
    isLiked: view?.liked ?? false,
    ...(isAuthor ? { viewsCount: row.viewsCount } : {}),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

/** Highlight columns + the first story as a fallback cover. */
export const highlightSelect = {
  id: true,
  ownerId: true,
  title: true,
  coverUrl: true,
  createdAt: true,
  _count: { select: { items: true } },
  items: {
    orderBy: [{ story: { createdAt: 'asc' } }, { storyId: 'asc' }],
    take: 1,
    select: { story: { select: { url: true, thumbnailUrl: true } } },
  },
} satisfies Prisma.HighlightSelect;

export type HighlightRow = Prisma.HighlightGetPayload<{ select: typeof highlightSelect }>;

export function toHighlightDto(row: HighlightRow): Highlight {
  const first = row.items[0]?.story;
  return {
    id: row.id,
    title: row.title,
    coverUrl: row.coverUrl ?? (first ? (first.thumbnailUrl ?? first.url) : null),
    storiesCount: row._count.items,
    createdAt: row.createdAt.toISOString(),
  };
}
