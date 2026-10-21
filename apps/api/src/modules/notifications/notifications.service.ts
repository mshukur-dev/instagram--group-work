import { Injectable } from '@nestjs/common';
import type { NotificationType } from '@instagram/shared';

export type NotificationInput = {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  storyId?: string;
};

/**
 * CONTRACT used by other modules — the signatures below are fixed.
 * Implementation is owned by the notifications session (docs/ROADMAP.md, session 3).
 */
@Injectable()
export class NotificationsService {
  /**
   * Creates a notification, emits `notification:new` and sends a web push.
   * Does nothing if recipientId === actorId. Never throws: callers don't await errors.
   */
  async create(_input: NotificationInput): Promise<void> {
    // TODO(session 3): save, emit via RealtimeService, PushService.notify
  }

  /**
   * Removes a notification when the action is undone (unlike, unfollow, delete comment).
   * Matches by all provided fields.
   */
  async remove(_input: NotificationInput): Promise<void> {
    // TODO(session 3)
  }
}
