import type { Notification as NotificationRow, PostType } from '@prisma/client';
import type { Notification, UserPreview, ViewerFollowStatus } from '@instagram/shared';

export type NotificationPostRef = { id: string; type: PostType; thumbnailUrl: string | null };
export type NotificationCommentRef = { id: string; text: string };

export function toNotificationDto(
  row: NotificationRow,
  actor: UserPreview,
  post: NotificationPostRef | undefined,
  comment: NotificationCommentRef | undefined,
  actorFollowStatus: ViewerFollowStatus,
): Notification {
  return {
    id: row.id,
    type: row.type,
    actor,
    post: post ?? null,
    comment: comment ?? null,
    storyId: row.storyId,
    actorFollowStatus,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}
