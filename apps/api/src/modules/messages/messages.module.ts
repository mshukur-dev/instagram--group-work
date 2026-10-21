import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { StoriesModule } from '../stories/stories.module';
import { MembersService } from './members.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

/**
 * Messages, reactions and the membership checks shared by conversations and calls.
 * Lowest layer of Direct: ConversationsModule and CallsModule import it.
 */
@Module({
  imports: [PostsModule, StoriesModule],
  controllers: [MessagesController],
  providers: [MembersService, MessagesService],
  exports: [MembersService, MessagesService],
})
export class MessagesModule {}
