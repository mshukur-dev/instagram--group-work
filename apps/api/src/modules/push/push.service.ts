import { Injectable } from '@nestjs/common';
import type { Language, PushPayload } from '@instagram/shared';

/** Matches the toggles in NotificationSettings. */
export type PushCategory = 'likes' | 'comments' | 'follows' | 'messages' | 'calls';

/**
 * CONTRACT used by other modules — the signature below is fixed.
 * Implementation is owned by the push session (docs/ROADMAP.md, session 3; docs/spec/push.md).
 */
@Injectable()
export class PushService {
  /**
   * Sends a web push to all browsers of the user, unless:
   * the user has a focused tab, push is disabled/paused, or the category is turned off.
   * `build` receives the recipient's language and returns the localized payload.
   * Fire-and-forget: never throws, don't await in request handlers.
   */
  notify(_userId: string, _category: PushCategory, _build: (language: Language) => PushPayload): void {
    // TODO(session 3)
  }
}
