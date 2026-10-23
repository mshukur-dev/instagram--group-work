import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  adminPostsQuerySchema,
  adminSearchQuerySchema,
  adminUsersQuerySchema,
  banUserSchema,
  type AdminAction,
  type AdminComment,
  type AdminPost,
  type AdminPostsQuery,
  type AdminSearchQuery,
  type AdminStats,
  type AdminUser,
  type AdminUsersQuery,
  type BanUserInput,
  type Page,
} from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { AdminService } from './admin.service';

const searchQuery = new ZodValidationPipe(adminSearchQuerySchema);

/** Admin panel API (ADMIN-1…ADMIN-6). Non-admins get 404 from AdminGuard. */
@ApiTags('admin')
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  stats(): Promise<AdminStats> {
    return this.adminService.stats();
  }

  @Get('users')
  users(
    @Query(new ZodValidationPipe(adminUsersQuerySchema)) query: AdminUsersQuery,
  ): Promise<Page<AdminUser>> {
    return this.adminService.users(query);
  }

  @Get('users/:id')
  user(@Param('id') id: string): Promise<AdminUser> {
    return this.adminService.user(id);
  }

  @Post('users/:id/ban')
  @HttpCode(200)
  @ApiZodBody(banUserSchema)
  ban(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(banUserSchema)) dto: BanUserInput,
  ): Promise<AdminUser> {
    return this.adminService.ban(admin.id, id, dto);
  }

  @Delete('users/:id/ban')
  unban(@CurrentUser() admin: AuthUser, @Param('id') id: string): Promise<AdminUser> {
    return this.adminService.unban(admin.id, id);
  }

  @Get('posts')
  posts(
    @Query(new ZodValidationPipe(adminPostsQuerySchema)) query: AdminPostsQuery,
  ): Promise<Page<AdminPost>> {
    return this.adminService.postList(query);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  deletePost(@CurrentUser() admin: AuthUser, @Param('id') id: string): Promise<void> {
    return this.adminService.deletePost(admin.id, id);
  }

  @Get('comments')
  comments(@Query(searchQuery) query: AdminSearchQuery): Promise<Page<AdminComment>> {
    return this.adminService.commentList(query);
  }

  @Delete('comments/:id')
  @HttpCode(204)
  deleteComment(@CurrentUser() admin: AuthUser, @Param('id') id: string): Promise<void> {
    return this.adminService.deleteComment(admin.id, id);
  }

  @Get('actions')
  actions(@Query(searchQuery) query: AdminSearchQuery): Promise<Page<AdminAction>> {
    return this.adminService.actions(query);
  }
}
