import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type Message,
  type Page,
  type PageQuery,
  type ReactionInput,
  type SendMessageInput,
  pageQuerySchema,
  reactionSchema,
  sendMessageSchema,
} from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { MessagesService } from './messages.service';

/** Rate limit for sending messages (docs/spec/backend.md §3.11). */
export const SEND_MESSAGE_THROTTLE = { default: { limit: 60, ttl: 60_000 } };

@ApiTags('direct')
@Controller()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('conversations/:id/messages')
  list(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ): Promise<Page<Message>> {
    return this.messages.list(user.id, id, query);
  }

  @Post('conversations/:id/messages')
  @Throttle(SEND_MESSAGE_THROTTLE)
  @ApiZodBody(sendMessageSchema)
  send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) dto: SendMessageInput,
  ): Promise<Message> {
    return this.messages.send(user.id, id, dto);
  }

  @Delete('messages/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.messages.remove(user.id, id);
  }

  @Put('messages/:id/reaction')
  @HttpCode(204)
  @ApiZodBody(reactionSchema)
  react(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reactionSchema)) dto: ReactionInput,
  ): Promise<void> {
    return this.messages.setReaction(user.id, id, dto.emoji);
  }

  @Delete('messages/:id/reaction')
  @HttpCode(204)
  unreact(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.messages.removeReaction(user.id, id);
  }
}
