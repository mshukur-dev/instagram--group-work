import { Global, Module } from '@nestjs/common';
import { FollowsService } from './follows.service';

/** Global: visibility checks (canViewContent, blocks) are needed by most modules. */
@Global()
@Module({
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
