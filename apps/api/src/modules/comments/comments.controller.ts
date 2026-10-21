import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createCommentSchema,
  pageQuerySchema,
  type Comment,
  type CreateCommentInput,
  type Page,
  type PageQuery,
} from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { CommentsService } from './comments.service';

const pageQuery = new ZodValidationPipe(pageQuerySchema);

@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('posts/:id/comments')
  list(
    @CurrentUser() user: AuthUser,
    @Param('id') postId: string,
    @Query(pageQuery) query: PageQuery,
  ): Promise<Page<Comment>> {
    return this.commentsService.list(user.id, postId, query);
  }

  @Post('posts/:id/comments')
  @ApiZodBody(createCommentSchema)
  create(
    @CurrentUser() user: AuthUser,
    @Param('id') postId: string,
    @Body(new ZodValidationPipe(createCommentSchema)) dto: CreateCommentInput,
  ): Promise<Comment> {
    return this.commentsService.create(user.id, postId, dto);
  }

  @Get('comments/:id/replies')
  replies(
    @CurrentUser() user: AuthUser,
    @Param('id') commentId: string,
    @Query(pageQuery) query: PageQuery,
  ): Promise<Page<Comment>> {
    return this.commentsService.replies(user.id, commentId, query);
  }

  @Delete('comments/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') commentId: string): Promise<void> {
    return this.commentsService.remove(user.id, commentId);
  }
}
