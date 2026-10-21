import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { pageQuerySchema, type Page, type PageQuery, type Post } from '@instagram/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { FeedService } from './feed.service';

const pageQuery = new ZodValidationPipe(pageQuerySchema);

/** Profile grids. `:username` may be `me`. */
@ApiTags('users')
@Controller('users')
export class ProfilePostsController {
  constructor(private readonly feedService: FeedService) {}

  @Get('me/saved')
  saved(@CurrentUser() user: AuthUser, @Query(pageQuery) query: PageQuery): Promise<Page<Post>> {
    return this.feedService.saved(user.id, query);
  }

  @Get(':username/posts')
  posts(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
    @Query(pageQuery) query: PageQuery,
  ): Promise<Page<Post>> {
    return this.feedService.userPosts(user.id, username, 'POST', query);
  }

  @Get(':username/reels')
  reels(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
    @Query(pageQuery) query: PageQuery,
  ): Promise<Page<Post>> {
    return this.feedService.userPosts(user.id, username, 'REEL', query);
  }

  @Get(':username/tagged')
  tagged(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
    @Query(pageQuery) query: PageQuery,
  ): Promise<Page<Post>> {
    return this.feedService.taggedPosts(user.id, username, query);
  }
}
