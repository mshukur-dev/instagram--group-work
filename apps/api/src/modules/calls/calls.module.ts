import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { LiveKitService } from './livekit.service';

/** Audio / video calls over LiveKit (docs/spec/calls.md). */
@Module({
  imports: [ConversationsModule, MessagesModule],
  controllers: [CallsController],
  providers: [CallsService, LiveKitService],
})
export class CallsModule {}
