import { Global, Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

/**
 * Global: any service can emit socket events via RealtimeService.
 * The Socket.IO gateway (connection auth, presence, typing) lives here too.
 */
@Global()
@Module({
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
