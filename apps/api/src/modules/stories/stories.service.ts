import { Injectable } from '@nestjs/common';
import type { Story } from '@instagram/shared';

/**
 * CONTRACT used by other modules — the signature of getByIds is fixed.
 * Implementation is owned by the stories session (docs/ROADMAP.md, session 3).
 */
@Injectable()
export class StoriesService {
  /**
   * Stories mapped to the API shape for this viewer, including expired ones
   * (a story reply in DM keeps showing the story preview). Stories the viewer
   * can't access are omitted. Used by messages (STORY_REPLY).
   */
  async getByIds(_viewerId: string, _ids: string[]): Promise<Map<string, Story>> {
    // TODO(session 3)
    return new Map();
  }
}
