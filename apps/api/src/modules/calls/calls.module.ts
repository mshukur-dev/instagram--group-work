import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { LiveKitEventsService } from './livekit-events.service';
import { LiveKitService } from './livekit.service';

/** Audio / video calls over LiveKit (docs/spec/calls.md). */
@Module({
  imports: [ConversationsModule, MessagesModule],
  controllers: [CallsController],
  providers: [CallsService, LiveKitService, LiveKitEventsService],
  exports: [LiveKitService, LiveKitEventsService],
})
export class CallsModule {}
