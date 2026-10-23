import type { Prisma } from '@prisma/client';
import type { AdminAction, AdminComment, AdminPost, AdminUser } from '@instagram/shared';

export const adminUserRefSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export const adminUserSelect = {
  ...adminUserRefSelect,
  email: true,
  role: true,
  lastSeenAt: true,
  postsCount: true,
  followersCount: true,
  bannedAt: true,
  banReason: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const firstMedia = {
  orderBy: { order: 'asc' },
  take: 1,
  select: { type: true, url: true, thumbnailUrl: true },
} satisfies Prisma.Post$mediaArgs;

export const adminPostSelect = {
  id: true,
  type: true,
  caption: true,
  likesCount: true,
  commentsCount: true,
  createdAt: true,
  author: { select: adminUserRefSelect },
  media: firstMedia,
  _count: { select: { media: true } },
} satisfies Prisma.PostSelect;

export const adminCommentSelect = {
  id: true,
  text: true,
  postId: true,
  parentId: true,
  createdAt: true,
  author: { select: adminUserRefSelect },
  post: { select: { media: firstMedia } },
} satisfies Prisma.CommentSelect;

export const adminActionSelect = {
  id: true,
  type: true,
  targetId: true,
  details: true,
  createdAt: true,
  admin: { select: adminUserRefSelect },
  targetUser: { select: adminUserRefSelect },
} satisfies Prisma.AdminActionSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;
type PostRow = Prisma.PostGetPayload<{ select: typeof adminPostSelect }>;
type CommentRow = Prisma.CommentGetPayload<{ select: typeof adminCommentSelect }>;
type ActionRow = Prisma.AdminActionGetPayload<{ select: typeof adminActionSelect }>;
type MediaRow = PostRow['media'][number];

/** Poster frame for videos, the file itself for images */
const previewOf = (media: MediaRow | undefined): string | null =>
  media ? (media.type === 'VIDEO' ? (media.thumbnailUrl ?? media.url) : media.url) : null;

export function toAdminUser(row: UserRow, isOnline: boolean): AdminUser {
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    avatarUrl: row.avatarUrl,
    email: row.email,
    role: row.role,
    isOnline,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    postsCount: row.postsCount,
    followersCount: row.followersCount,
    bannedAt: row.bannedAt?.toISOString() ?? null,
    banReason: row.banReason,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAdminPost(row: PostRow): AdminPost {
  const media = row.media[0];
  return {
    id: row.id,
    type: row.type,
    author: row.author,
    caption: row.caption,
    previewUrl: previewOf(media) ?? '',
    previewType: media?.type ?? 'IMAGE',
    mediaCount: row._count.media,
    likesCount: row.likesCount,
    commentsCount: row.commentsCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAdminComment(row: CommentRow): AdminComment {
  return {
    id: row.id,
    text: row.text,
    author: row.author,
    postId: row.postId,
    postPreviewUrl: previewOf(row.post.media[0]),
    isReply: row.parentId !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAdminAction(row: ActionRow): AdminAction {
  return {
    id: row.id,
    type: row.type,
    admin: row.admin,
    targetUser: row.targetUser,
    targetId: row.targetId,
    details: (row.details as Record<string, string | null> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
