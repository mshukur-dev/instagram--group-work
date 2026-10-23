import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AddMembersInput,
  type Conversation,
  type ConversationPreview,
  type Count,
  type CreateGroupInput,
  type Message,
  type Page,
  type PageQuery,
  type SendMessageInput,
  type UpdateConversationInput,
  addMembersSchema,
  createGroupSchema,
  pageQuerySchema,
  sendMessageSchema,
  updateConversationSchema,
} from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { SEND_MESSAGE_THROTTLE } from '../messages/messages.controller';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from './conversations.service';

@ApiTags('direct')
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ): Promise<Page<ConversationPreview>> {
    return this.conversations.list(user.id, query);
  }

  // declared before :id so "unread-count" is not taken for an id
  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser): Promise<Count> {
    return this.conversations.unreadCount(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Conversation> {
    return this.conversations.get(user.id, id);
  }

  /** Find or create the 1:1 chat with this user. */
  @Post('direct/:userId')
  @HttpCode(200)
  openDirect(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ): Promise<Conversation> {
    return this.conversations.openDirect(user.id, userId);
  }

  /** Send to a user without a chat id yet (e.g. story reply); creates the chat if needed. */
  @Post('direct/:userId/messages')
  @Throttle(SEND_MESSAGE_THROTTLE)
  @ApiZodBody(sendMessageSchema)
  async sendDirect(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) dto: SendMessageInput,
  ): Promise<Message> {
    const conversationId = await this.conversations.findOrCreateDirect(user.id, userId);
    return this.messages.send(user.id, conversationId, dto);
  }

  @Post('group')
  @ApiZodBody(createGroupSchema)
  createGroup(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createGroupSchema)) dto: CreateGroupInput,
  ): Promise<Conversation> {
    return this.conversations.createGroup(user.id, dto);
  }

  @Patch(':id')
  @ApiZodBody(updateConversationSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateConversationSchema)) dto: UpdateConversationInput,
  ): Promise<Conversation> {
    return this.conversations.update(user.id, id, dto);
  }

  @Post(':id/members')
  @HttpCode(204)
  @ApiZodBody(addMembersSchema)
  addMembers(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addMembersSchema)) dto: AddMembersInput,
  ): Promise<void> {
    return this.conversations.addMembers(user.id, id, dto);
  }

  /** Admin removes a member; removing yourself = leaving the group. */
  @Delete(':id/members/:userId')
  @HttpCode(204)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.conversations.removeMember(user.id, id, userId);
  }

  /** "Delete chat" for me only (a group: also leave it). */
  @Delete(':id')
  @HttpCode(204)
  deleteForMe(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.conversations.deleteForMe(user.id, id);
  }

  @Post(':id/read')
  @HttpCode(204)
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.conversations.markRead(user.id, id);
  }
}
