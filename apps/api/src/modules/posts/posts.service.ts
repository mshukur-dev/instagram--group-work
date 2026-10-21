import { Injectable } from '@nestjs/common';
import type { Post } from '@instagram/shared';

/**
 * CONTRACT used by other modules — the signature of getByIds is fixed.
 * Implementation is owned by the posts session (docs/ROADMAP.md, session 2).
 */
@Injectable()
export class PostsService {
  /**
   * Posts mapped to the API shape for this viewer (isLiked, isSaved, author preview…).
   * Posts the viewer can't see (private / blocked / deleted) are omitted from the map.
   * Used by messages (shared posts in DM).
   */
  async getByIds(_viewerId: string, _ids: string[]): Promise<Map<string, Post>> {
    // TODO(session 2)
    return new Map();
  }
}
