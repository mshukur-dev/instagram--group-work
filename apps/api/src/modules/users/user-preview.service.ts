import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { UserPreview } from '@instagram/shared';
import { PrismaService } from '../../prisma/prisma.service';

/** Minimal user columns needed to build a UserPreview. Use in Prisma `select`/`include`. */
export const userPreviewSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export type UserPreviewRow = Prisma.UserGetPayload<{ select: typeof userPreviewSelect }>;

type StoryState = { hasActiveStory: boolean; hasUnseenStory: boolean };

/**
 * Builds UserPreview objects (the user chip shown everywhere: avatar + story ring).
 * Story rings need per-viewer data, so previews are always built in batches:
 *
 *   const previews = await this.userPreview.build(viewerId, rows.map((r) => r.author));
 *   previews.get(row.author.id)
 */
@Injectable()
export class UserPreviewService {
  constructor(private readonly prisma: PrismaService) {}

  async build(viewerId: string, users: UserPreviewRow[]): Promise<Map<string, UserPreview>> {
    const unique = [...new Map(users.map((u) => [u.id, u])).values()];
    const states = await this.storyStates(viewerId, unique.map((u) => u.id));
    return new Map(
      unique.map((u) => [u.id, this.toPreview(u, states.get(u.id))]),
    );
  }

  async buildOne(viewerId: string, user: UserPreviewRow): Promise<UserPreview> {
    const map = await this.build(viewerId, [user]);
    return map.get(user.id) ?? this.toPreview(user);
  }

  /** Builds a list keeping the original order. */
  async buildList(viewerId: string, users: UserPreviewRow[]): Promise<UserPreview[]> {
    const map = await this.build(viewerId, users);
    return users.map((u) => map.get(u.id) ?? this.toPreview(u));
  }

  toPreview(user: UserPreviewRow, state?: StoryState): UserPreview {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      hasActiveStory: state?.hasActiveStory ?? false,
      hasUnseenStory: state?.hasUnseenStory ?? false,
    };
  }

  /**
   * Active story = not expired; unseen = the viewer has no StoryView for it.
   * Access to private accounts is enforced by the stories module when opening them.
   */
  async storyStates(viewerId: string, userIds: string[]): Promise<Map<string, StoryState>> {
    const result = new Map<string, StoryState>();
    if (userIds.length === 0) return result;

    const stories = await this.prisma.story.findMany({
      where: { authorId: { in: userIds }, expiresAt: { gt: new Date() } },
      select: { id: true, authorId: true },
    });
    if (stories.length === 0) return result;

    const seen = await this.prisma.storyView.findMany({
      where: { viewerId, storyId: { in: stories.map((s) => s.id) } },
      select: { storyId: true },
    });
    const seenIds = new Set(seen.map((v) => v.storyId));

    for (const story of stories) {
      const state = result.get(story.authorId) ?? { hasActiveStory: true, hasUnseenStory: false };
      if (!seenIds.has(story.id)) state.hasUnseenStory = true;
      result.set(story.authorId, state);
    }
    return result;
  }
}
