import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type CreateStoryInput,
  createStorySchema,
  type Highlight,
  type Page,
  type PageQuery,
  pageQuerySchema,
  type Story,
  type StoryTray,
  type StoryViewer,
} from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { HighlightsService } from './highlights.service';
import { StoriesService } from './stories.service';

@ApiTags('stories')
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  @ApiZodBody(createStorySchema)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createStorySchema)) dto: CreateStoryInput,
  ): Promise<Story> {
    return this.storiesService.create(user.id, dto);
  }

  @Get('feed')
  feed(@CurrentUser() user: AuthUser): Promise<StoryTray[]> {
    return this.storiesService.tray(user.id);
  }

  @Get('archive')
  archive(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ): Promise<Page<Story>> {
    return this.storiesService.archive(user.id, query);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.storiesService.remove(user.id, id);
  }

  @Post(':id/view')
  @HttpCode(204)
  async view(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.storiesService.view(user.id, id);
  }

  @Post(':id/like')
  @HttpCode(204)
  async like(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.storiesService.like(user.id, id);
  }

  @Delete(':id/like')
  @HttpCode(204)
  async unlike(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.storiesService.unlike(user.id, id);
  }

  @Get(':id/viewers')
  viewers(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ): Promise<Page<StoryViewer>> {
    return this.storiesService.viewers(user.id, id, query);
  }
}

/** Story routes nested under a profile: /users/:username/stories, /users/:username/highlights. */
@ApiTags('stories')
@Controller('users')
export class UserStoriesController {
  constructor(
    private readonly storiesService: StoriesService,
    private readonly highlightsService: HighlightsService,
  ) {}

  @Get(':username/stories')
  stories(@CurrentUser() user: AuthUser, @Param('username') username: string): Promise<Story[]> {
    return this.storiesService.listActive(user.id, username);
  }

  @Get(':username/highlights')
  highlights(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
  ): Promise<Highlight[]> {
    return this.highlightsService.listByUsername(user.id, username);
  }
}
