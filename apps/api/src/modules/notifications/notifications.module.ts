import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

/** Global: likes, comments, follows, stories create notifications. */
@Global()
@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
