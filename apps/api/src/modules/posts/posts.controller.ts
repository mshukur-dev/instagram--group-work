import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createPostSchema,
  pageQuerySchema,
  updatePostSchema,
  type CreatePostInput,
  type Hashtag,
  type Page,
  type PageQuery,
  type Post as PostDto,
  type UpdatePostInput,
} from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { FeedService } from './feed.service';
import { PostsService } from './posts.service';

const pageQuery = new ZodValidationPipe(pageQuerySchema);

@ApiTags('posts')
@Controller()
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly feedService: FeedService,
  ) {}

  @Post('posts')
  @ApiZodBody(createPostSchema)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createPostSchema)) dto: CreatePostInput,
  ): Promise<PostDto> {
    return this.postsService.create(user.id, dto);
  }

  @Get('posts/:id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<PostDto> {
    return this.postsService.getOne(user.id, id);
  }

  @Patch('posts/:id')
  @ApiZodBody(updatePostSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePostSchema)) dto: UpdatePostInput,
  ): Promise<PostDto> {
    return this.postsService.update(user.id, id, dto);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.postsService.remove(user.id, id);
  }

  @Post('posts/:id/view')
  @HttpCode(204)
  view(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.postsService.view(user.id, id);
  }

  @Get('feed')
  feed(@CurrentUser() user: AuthUser, @Query(pageQuery) query: PageQuery): Promise<Page<PostDto>> {
    return this.feedService.feed(user.id, query);
  }

  @Get('reels')
  reels(@CurrentUser() user: AuthUser, @Query(pageQuery) query: PageQuery): Promise<Page<PostDto>> {
    return this.feedService.reels(user.id, query);
  }

  @Get('explore')
  explore(
    @CurrentUser() user: AuthUser,
    @Query(pageQuery) query: PageQuery,
  ): Promise<Page<PostDto>> {
    return this.feedService.explore(user.id, query);
  }

  @Get('hashtags/:name')
  hashtag(@Param('name') name: string): Promise<Hashtag> {
    return this.feedService.hashtag(name);
  }

  @Get('hashtags/:name/posts')
  hashtagPosts(
    @CurrentUser() user: AuthUser,
    @Param('name') name: string,
    @Query(pageQuery) query: PageQuery,
  ): Promise<Page<PostDto>> {
    return this.feedService.hashtagPosts(user.id, name, query);
  }
}
