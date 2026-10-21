import { Global, Module } from '@nestjs/common';
import { UserPreviewService } from './user-preview.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/** Global: UserPreviewService is used by almost every module. */
@Global()
@Module({
  controllers: [UsersController],
  providers: [UsersService, UserPreviewService],
  exports: [UsersService, UserPreviewService],
})
export class UsersModule {}
