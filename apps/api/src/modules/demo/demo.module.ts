import { Module } from '@nestjs/common';
import { CommentsModule } from '../comments/comments.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { LikesModule } from '../likes/likes.module';
import { MessagesModule } from '../messages/messages.module';
import { StoriesModule } from '../stories/stories.module';
import { DemoBotsService } from './demo-bots.service';

/** Demo bots: the seed's demo accounts act on their own when DEMO_BOTS=true (off by default). */
@Module({
  imports: [LikesModule, CommentsModule, StoriesModule, MessagesModule, ConversationsModule],
  providers: [DemoBotsService],
})
export class DemoModule {}
