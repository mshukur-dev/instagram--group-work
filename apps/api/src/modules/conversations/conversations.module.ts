import { Module } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

/** Chats: 1:1 and groups, members, read state. Builds ConversationPreview for calls too. */
@Module({
  imports: [MessagesModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
