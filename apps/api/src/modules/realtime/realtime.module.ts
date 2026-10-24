import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

/**
 * Global: any service can emit socket events via RealtimeService.
 * The Socket.IO gateway (connection auth, presence, typing) lives here too.
 */
@Global()
@Module({
  imports: [AuthModule], // TokensService.verifySocket for the handshake
  providers: [RealtimeService, PresenceService, RealtimeGateway],
  exports: [RealtimeService, PresenceService],
})
export class RealtimeModule {}
