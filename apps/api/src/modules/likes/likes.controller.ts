import { Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  filteredPageQuerySchema,
  type FilteredPageQuery,
  type LikesCount,
  type Page,
  type UserListItem,
} from '@instagram/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { LikesService } from './likes.service';

@ApiTags('likes')
@Controller()
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post('posts/:id/like')
  @HttpCode(200)
  likePost(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<LikesCount> {
    return this.likesService.likePost(user.id, id);
  }

  @Delete('posts/:id/like')
  unlikePost(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<LikesCount> {
    return this.likesService.unlikePost(user.id, id);
  }

  @Get('posts/:id/likes')
  likers(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(filteredPageQuerySchema)) query: FilteredPageQuery,
  ): Promise<Page<UserListItem>> {
    return this.likesService.likers(user.id, id, query);
  }

  @Post('posts/:id/save')
  @HttpCode(204)
  save(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.likesService.save(user.id, id);
  }

  @Delete('posts/:id/save')
  @HttpCode(204)
  unsave(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.likesService.unsave(user.id, id);
  }

  @Post('comments/:id/like')
  @HttpCode(200)
  likeComment(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<LikesCount> {
    return this.likesService.likeComment(user.id, id);
  }

  @Delete('comments/:id/like')
  unlikeComment(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<LikesCount> {
    return this.likesService.unlikeComment(user.id, id);
  }
}
