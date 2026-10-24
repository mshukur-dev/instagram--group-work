import { Global, Module } from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { FollowActionsService } from './follow-actions.service';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

/** Global: visibility checks (canViewContent, blocks) are needed by most modules. */
@Global()
@Module({
  controllers: [FollowsController],
  providers: [FollowsService, FollowActionsService, BlocksService],
  exports: [FollowsService, FollowActionsService],
})
export class FollowsModule {}
