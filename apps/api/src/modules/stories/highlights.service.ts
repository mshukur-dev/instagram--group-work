import { Injectable } from '@nestjs/common';
import {
  type CreateHighlightInput,
  ErrorCode,
  type Highlight,
  type Story,
  type UpdateHighlightInput,
} from '@instagram/shared';
import { forbidden, notFound } from '../../common/errors/app-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowsService } from '../follows/follows.service';
import { highlightSelect, storySelect, toHighlightDto } from './stories.mapper';
import { StoriesService } from './stories.service';

/** Highlights (STORY-8): own stories saved on the profile forever, even after they expire. */
@Injectable()
export class HighlightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly follows: FollowsService,
    private readonly stories: StoriesService,
  ) {}

  async listByUsername(viewerId: string, username: string): Promise<Highlight[]> {
    const ownerId = await this.stories.resolveVisibleUser(viewerId, username);
    const rows = await this.prisma.highlight.findMany({
      where: { ownerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: highlightSelect,
    });
    return rows.map(toHighlightDto);
  }

  async create(userId: string, dto: CreateHighlightInput): Promise<Highlight> {
    const storyIds = await this.ownStoryIds(userId, dto.storyIds);
    const row = await this.prisma.highlight.create({
      data: {
        ownerId: userId,
        title: dto.title,
        coverUrl: dto.coverUrl ?? null,
        items: { createMany: { data: storyIds.map((storyId) => ({ storyId })) } },
      },
      select: highlightSelect,
    });
    return toHighlightDto(row);
  }

  async update(userId: string, highlightId: string, dto: UpdateHighlightInput): Promise<Highlight> {
    await this.getOwn(userId, highlightId);
    const addIds = dto.addStoryIds?.length ? await this.ownStoryIds(userId, dto.addStoryIds) : [];

    await this.prisma.$transaction([
      this.prisma.highlight.update({
        where: { id: highlightId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.coverUrl !== undefined ? { coverUrl: dto.coverUrl } : {}),
        },
      }),
      this.prisma.highlightItem.createMany({
        data: addIds.map((storyId) => ({ highlightId, storyId })),
        skipDuplicates: true,
      }),
      this.prisma.highlightItem.deleteMany({
        where: { highlightId, storyId: { in: dto.removeStoryIds ?? [] } },
      }),
    ]);

    const row = await this.prisma.highlight.findUniqueOrThrow({
      where: { id: highlightId },
      select: highlightSelect,
    });
    return toHighlightDto(row);
  }

  async remove(userId: string, highlightId: string): Promise<void> {
    await this.getOwn(userId, highlightId);
    await this.prisma.highlight.delete({ where: { id: highlightId } });
  }

  /** Stories of a highlight in the order they were posted. */
  async listStories(viewerId: string, highlightId: string): Promise<Story[]> {
    const highlight = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      select: { ownerId: true },
    });
    if (!highlight || !(await this.follows.canViewContent(viewerId, highlight.ownerId))) {
      throw notFound(ErrorCode.HIGHLIGHT_NOT_FOUND, 'Highlight not found.');
    }
    const rows = await this.prisma.story.findMany({
      where: { highlights: { some: { highlightId } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: storySelect,
    });
    return this.stories.mapStories(viewerId, rows);
  }

  private async getOwn(userId: string, highlightId: string): Promise<void> {
    const highlight = await this.prisma.highlight.findUnique({
      where: { id: highlightId },
      select: { ownerId: true },
    });
    if (!highlight) throw notFound(ErrorCode.HIGHLIGHT_NOT_FOUND, 'Highlight not found.');
    if (highlight.ownerId !== userId) {
      throw forbidden(ErrorCode.FORBIDDEN, "You can't edit this highlight.");
    }
  }

  /** Only the user's own stories can be added; any foreign or missing id fails the request. */
  private async ownStoryIds(userId: string, ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    const found = await this.prisma.story.findMany({
      where: { id: { in: unique }, authorId: userId },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw notFound(ErrorCode.STORY_NOT_FOUND, 'Story not found.');
    }
    return unique;
  }
}
