import { Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type FilteredPageQuery,
  filteredPageQuerySchema,
  type FollowStatus,
  type Page,
  type PageQuery,
  pageQuerySchema,
  type UserListItem,
  type UserPreview,
} from '@instagram/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { BlocksService } from './blocks.service';
import { FollowActionsService } from './follow-actions.service';

@ApiTags('follows')
@Controller()
export class FollowsController {
  constructor(
    private readonly followActions: FollowActionsService,
    private readonly blocks: BlocksService,
  ) {}

  // ───── Block (static `me/blocked` before `:username/...`) ─────

  @Get('users/me/blocked')
  listBlocked(@CurrentUser() user: AuthUser): Promise<UserPreview[]> {
    return this.blocks.listBlocked(user.id);
  }

  @Post('users/:username/block')
  @HttpCode(204)
  block(@CurrentUser() user: AuthUser, @Param('username') username: string): Promise<void> {
    return this.blocks.block(user.id, username);
  }

  @Delete('users/:username/block')
  @HttpCode(204)
  unblock(@CurrentUser() user: AuthUser, @Param('username') username: string): Promise<void> {
    return this.blocks.unblock(user.id, username);
  }

  // ───── Follow ─────

  @Post('users/:username/follow')
  @HttpCode(200)
  follow(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
  ): Promise<{ followStatus: FollowStatus }> {
    return this.followActions.follow(user.id, username);
  }

  @Delete('users/:username/follow')
  @HttpCode(204)
  unfollow(@CurrentUser() user: AuthUser, @Param('username') username: string): Promise<void> {
    return this.followActions.unfollow(user.id, username);
  }

  @Delete('users/:username/follower')
  @HttpCode(204)
  removeFollower(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
  ): Promise<void> {
    return this.followActions.removeFollower(user.id, username);
  }

  @Get('users/:username/followers')
  followers(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
    @Query(new ZodValidationPipe(filteredPageQuerySchema)) query: FilteredPageQuery,
  ): Promise<Page<UserListItem>> {
    return this.followActions.listFollowers(user.id, username, query);
  }

  @Get('users/:username/following')
  following(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
    @Query(new ZodValidationPipe(filteredPageQuerySchema)) query: FilteredPageQuery,
  ): Promise<Page<UserListItem>> {
    return this.followActions.listFollowing(user.id, username, query);
  }

  // ───── Follow requests (to my private account) ─────

  @Get('follow-requests')
  listRequests(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ): Promise<Page<UserPreview>> {
    return this.followActions.listRequests(user.id, query);
  }

  @Post('follow-requests/:userId/accept')
  @HttpCode(204)
  accept(@CurrentUser() user: AuthUser, @Param('userId') userId: string): Promise<void> {
    return this.followActions.acceptRequest(user.id, userId);
  }

  @Delete('follow-requests/:userId')
  @HttpCode(204)
  decline(@CurrentUser() user: AuthUser, @Param('userId') userId: string): Promise<void> {
    return this.followActions.declineRequest(user.id, userId);
  }
}
