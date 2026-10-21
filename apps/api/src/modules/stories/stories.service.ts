import { Injectable } from '@nestjs/common';
import {
  type CreateStoryInput,
  ErrorCode,
  type Page,
  type PageQuery,
  type Story,
  STORY_TTL_HOURS,
  STORY_VIDEO_MAX_SECONDS,
  type StoryTray,
  type StoryViewer,
} from '@instagram/shared';
import { badRequest, forbidden, notFound } from '../../common/errors/app-exception';
import { cursorArgs, toPageBy } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowsService } from '../follows/follows.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserPreviewService, userPreviewSelect } from '../users/user-preview.service';
import { type StoryRow, storySelect, toStoryDto } from './stories.mapper';

const HOUR_MS = 60 * 60 * 1000;

/** Stories, views and likes (STORY-1…7). Active story = expiresAt > now; expired ones are kept. */
@Injectable()
export class StoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly follows: FollowsService,
    private readonly userPreview: UserPreviewService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
  ) {}

  async create(userId: string, dto: CreateStoryInput): Promise<Story> {
    if (dto.type === 'VIDEO' && dto.duration && dto.duration > STORY_VIDEO_MAX_SECONDS) {
      throw badRequest(
        ErrorCode.INVALID_MEDIA,
        `Story videos can be up to ${STORY_VIDEO_MAX_SECONDS} seconds long.`,
      );
    }
    const now = new Date();
    const row = await this.prisma.story.create({
      data: {
        authorId: userId,
        mediaType: dto.type,
        url: dto.url,
        publicId: dto.publicId,
        thumbnailUrl: dto.thumbnailUrl ?? null,
        duration: dto.type === 'VIDEO' ? (dto.duration ?? null) : null,
        createdAt: now,
        expiresAt: new Date(now.getTime() + STORY_TTL_HOURS * HOUR_MS),
      },
      select: storySelect,
    });
    const [story] = await this.mapStories(userId, [row]);
    return story as Story;
  }

  async remove(userId: string, storyId: string): Promise<void> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { authorId: true, publicId: true },
    });
    if (!story) throw notFound(ErrorCode.STORY_NOT_FOUND, 'Story not found.');
    if (story.authorId !== userId)
      throw forbidden(ErrorCode.FORBIDDEN, "You can't delete this story.");
    // Views, highlight items and notifications go with it; DM story replies keep the message (SetNull)
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({ where: { storyId } }),
      this.prisma.story.delete({ where: { id: storyId } }),
    ]);
    this.media.destroy([story.publicId]);
  }

  /** Story rings above the feed: me first, then users with unseen stories, then fully seen. */
  async tray(userId: string): Promise<StoryTray[]> {
    const [followingIds, blockedIds] = await Promise.all([
      this.follows.getFollowingIds(userId),
      this.follows.getBlockedUserIds(userId),
    ]);
    const blocked = new Set(blockedIds);
    const authorIds = [userId, ...followingIds.filter((id) => !blocked.has(id))];

    const stories = await this.prisma.story.findMany({
      where: { authorId: { in: authorIds }, expiresAt: { gt: new Date() } },
      select: { id: true, authorId: true, createdAt: true },
    });
    if (stories.length === 0) return [];

    const seen = await this.prisma.storyView.findMany({
      where: { viewerId: userId, storyId: { in: stories.map((s) => s.id) } },
      select: { storyId: true },
    });
    const seenIds = new Set(seen.map((v) => v.storyId));

    const byAuthor = new Map<string, { hasUnseen: boolean; latestAt: Date }>();
    for (const s of stories) {
      const entry = byAuthor.get(s.authorId) ?? { hasUnseen: false, latestAt: s.createdAt };
      if (!seenIds.has(s.id)) entry.hasUnseen = true;
      if (s.createdAt > entry.latestAt) entry.latestAt = s.createdAt;
      byAuthor.set(s.authorId, entry);
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...byAuthor.keys()] } },
      select: userPreviewSelect,
    });
    const previews = await this.userPreview.build(userId, users);

    const rank = (id: string, hasUnseen: boolean) => (id === userId ? 0 : hasUnseen ? 1 : 2);
    return [...byAuthor.entries()]
      .sort(
        ([idA, a], [idB, b]) =>
          rank(idA, a.hasUnseen) - rank(idB, b.hasUnseen) ||
          b.latestAt.getTime() - a.latestAt.getTime(),
      )
      .flatMap(([id, entry]) => {
        const user = previews.get(id);
        return user
          ? [{ user, hasUnseen: entry.hasUnseen, latestAt: entry.latestAt.toISOString() }]
          : [];
      });
  }

  /** Active stories of a user, oldest first (playback order). */
  async listActive(viewerId: string, username: string): Promise<Story[]> {
    const ownerId = await this.resolveVisibleUser(viewerId, username);
    const rows = await this.prisma.story.findMany({
      where: { authorId: ownerId, expiresAt: { gt: new Date() } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: storySelect,
    });
    return this.mapStories(viewerId, rows);
  }

  /** Marks the story as seen. Idempotent: viewsCount grows once per viewer, never for the author. */
  async view(userId: string, storyId: string): Promise<void> {
    const story = await this.getAccessible(userId, storyId);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.storyView.createMany({
        data: [{ storyId, viewerId: userId }],
        skipDuplicates: true,
      });
      if (count > 0 && story.authorId !== userId) {
        await tx.story.update({ where: { id: storyId }, data: { viewsCount: { increment: 1 } } });
      }
    });
  }

  async like(userId: string, storyId: string): Promise<void> {
    const story = await this.getAccessible(userId, storyId);
    if (story.authorId === userId) {
      throw forbidden(ErrorCode.FORBIDDEN, "You can't like your own story.");
    }
    const newlyLiked = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.storyView.findUnique({
        where: { storyId_viewerId: { storyId, viewerId: userId } },
        select: { liked: true },
      });
      if (existing?.liked) return false;
      if (existing) {
        await tx.storyView.update({
          where: { storyId_viewerId: { storyId, viewerId: userId } },
          data: { liked: true },
        });
      } else {
        // Liking without an explicit view still counts as a view
        await tx.storyView.create({ data: { storyId, viewerId: userId, liked: true } });
        await tx.story.update({ where: { id: storyId }, data: { viewsCount: { increment: 1 } } });
      }
      return true;
    });
    if (newlyLiked) {
      void this.notifications.create({
        recipientId: story.authorId,
        actorId: userId,
        type: 'STORY_LIKE',
        storyId,
      });
    }
  }

  async unlike(userId: string, storyId: string): Promise<void> {
    const story = await this.getAccessible(userId, storyId);
    const { count } = await this.prisma.storyView.updateMany({
      where: { storyId, viewerId: userId, liked: true },
      data: { liked: false },
    });
    if (count > 0) {
      void this.notifications.remove({
        recipientId: story.authorId,
        actorId: userId,
        type: 'STORY_LIKE',
        storyId,
      });
    }
  }

  /** Who viewed my story (author only), newest first. The author's own view is excluded. */
  async viewers(userId: string, storyId: string, query: PageQuery): Promise<Page<StoryViewer>> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { authorId: true },
    });
    if (!story) throw notFound(ErrorCode.STORY_NOT_FOUND, 'Story not found.');
    if (story.authorId !== userId) {
      throw forbidden(ErrorCode.FORBIDDEN, 'Only the author can see who viewed this story.');
    }
    const blocked = await this.follows.getBlockedUserIds(userId);
    const rows = await this.prisma.storyView.findMany({
      where: { storyId, viewerId: { notIn: [userId, ...blocked] } },
      orderBy: [{ createdAt: 'desc' }, { viewerId: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor
        ? { skip: 1, cursor: { storyId_viewerId: { storyId, viewerId: query.cursor } } }
        : {}),
      select: {
        viewerId: true,
        liked: true,
        createdAt: true,
        viewer: { select: userPreviewSelect },
      },
    });
    const previews = await this.userPreview.build(
      userId,
      rows.map((r) => r.viewer),
    );
    return toPageBy(
      rows,
      query.limit,
      (r) => r.viewerId,
      (r) => ({
        ...(previews.get(r.viewerId) ?? this.userPreview.toPreview(r.viewer)),
        liked: r.liked,
        viewedAt: r.createdAt.toISOString(),
      }),
    );
  }

  /** All my stories including expired ones, newest first. */
  async archive(userId: string, query: PageQuery): Promise<Page<Story>> {
    const rows = await this.prisma.story.findMany({
      where: { authorId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: storySelect,
      ...cursorArgs(query),
    });
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: await this.mapStories(userId, pageRows),
      nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
    };
  }

  /**
   * CONTRACT used by other modules — the signature is fixed.
   * Stories mapped to the API shape for this viewer, including expired ones
   * (a story reply in DM keeps showing the story preview). Stories the viewer
   * can't access are omitted. Used by messages (STORY_REPLY).
   */
  async getByIds(viewerId: string, ids: string[]): Promise<Map<string, Story>> {
    const result = new Map<string, Story>();
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return result;

    const rows = await this.prisma.story.findMany({
      where: { id: { in: uniqueIds } },
      select: storySelect,
    });
    const visible = await this.visibleAuthorIds(viewerId, [
      ...new Set(rows.map((r) => r.authorId)),
    ]);
    const stories = await this.mapStories(
      viewerId,
      rows.filter((r) => visible.has(r.authorId)),
    );
    for (const story of stories) result.set(story.id, story);
    return result;
  }

  /** Maps rows to DTOs with a fixed number of queries. Keeps the order. */
  async mapStories(viewerId: string, rows: StoryRow[]): Promise<Story[]> {
    if (rows.length === 0) return [];
    const [views, previews] = await Promise.all([
      this.prisma.storyView.findMany({
        where: { viewerId, storyId: { in: rows.map((r) => r.id) } },
        select: { storyId: true, liked: true },
      }),
      this.userPreview.build(
        viewerId,
        rows.map((r) => r.author),
      ),
    ]);
    const viewMap = new Map(views.map((v) => [v.storyId, v]));
    return rows.map((row) =>
      toStoryDto(
        row,
        viewerId,
        previews.get(row.authorId) ?? this.userPreview.toPreview(row.author),
        viewMap.get(row.id),
      ),
    );
  }

  /**
   * User id by username if the viewer may see their content.
   * Missing or blocked → 404 USER_NOT_FOUND; private and not followed → 403 PRIVATE_ACCOUNT.
   */
  async resolveVisibleUser(viewerId: string, username: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (!user || (await this.follows.isBlockedBetween(viewerId, user.id))) {
      throw notFound(ErrorCode.USER_NOT_FOUND, 'User not found.');
    }
    if (!(await this.follows.canViewContent(viewerId, user.id))) {
      throw forbidden(ErrorCode.PRIVATE_ACCOUNT, 'This account is private.');
    }
    return user.id;
  }

  /** Story the viewer may open (active or expired). Hidden ones look like missing ones. */
  private async getAccessible(viewerId: string, storyId: string): Promise<{ authorId: string }> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { authorId: true },
    });
    if (!story || !(await this.follows.canViewContent(viewerId, story.authorId))) {
      throw notFound(ErrorCode.STORY_NOT_FOUND, 'Story not found.');
    }
    return story;
  }

  /** Batched canViewContent for many authors (no N+1). */
  private async visibleAuthorIds(viewerId: string, authorIds: string[]): Promise<Set<string>> {
    if (authorIds.length === 0) return new Set();
    const [authors, blockedIds, statuses] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, isPrivate: true },
      }),
      this.follows.getBlockedUserIds(viewerId),
      this.follows.getFollowStatuses(viewerId, authorIds),
    ]);
    const blocked = new Set(blockedIds);
    return new Set(
      authors
        .filter(
          (a) =>
            a.id === viewerId ||
            (!blocked.has(a.id) && (!a.isPrivate || statuses.get(a.id) === 'ACCEPTED')),
        )
        .map((a) => a.id),
    );
  }
}
