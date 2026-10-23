import { Body, Controller, Get, HttpCode, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type ChangePasswordInput,
  changePasswordSchema,
  type LimitQuery,
  limitQuerySchema,
  type Me,
  type SuggestedUser,
  type UpdateProfileInput,
  updateProfileSchema,
  type UserProfile,
} from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { UsersService } from './users.service';

/**
 * Static routes (`me`, `suggestions`) are declared before `:username`.
 * Follow / block / followers lists live in FollowsController,
 * profile post grids in the posts module.
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser): Promise<Me> {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  @ApiZodBody(updateProfileSchema)
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileInput,
  ): Promise<Me> {
    return this.usersService.updateMe(user.id, dto);
  }

  @Patch('me/password')
  @HttpCode(204)
  @ApiZodBody(changePasswordSchema)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: ChangePasswordInput,
  ): Promise<void> {
    return this.usersService.changePassword(user.id, user.sessionId, dto);
  }

  @Get('suggestions')
  suggestions(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(limitQuerySchema)) query: LimitQuery,
  ): Promise<SuggestedUser[]> {
    return this.usersService.suggestions(user.id, query.limit);
  }

  @Get(':username')
  getProfile(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
  ): Promise<UserProfile> {
    return this.usersService.getProfile(user.id, username);
  }
}
