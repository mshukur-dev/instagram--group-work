import { Module } from '@nestjs/common';
import { CallsModule } from '../calls/calls.module';
import { FollowsModule } from '../follows/follows.module';
import { UsersModule } from '../users/users.module';
import { LivesController } from './lives.controller';
import { LivesService } from './lives.service';

/** Live videos over LiveKit (LIVE-*, docs/spec/live.md) */
@Module({
  imports: [CallsModule, FollowsModule, UsersModule],
  controllers: [LivesController],
  providers: [LivesService],
})
export class LivesModule {}
