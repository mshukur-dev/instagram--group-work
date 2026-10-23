import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppConfigModule } from './config/config.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CallsModule } from './modules/calls/calls.module';
import { LivesModule } from './modules/lives/lives.module';
import { CommentsModule } from './modules/comments/comments.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { FollowsModule } from './modules/follows/follows.module';
import { LikesModule } from './modules/likes/likes.module';
import { MediaModule } from './modules/media/media.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PostsModule } from './modules/posts/posts.module';
import { PushModule } from './modules/push/push.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SearchModule } from './modules/search/search.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StoriesModule } from './modules/stories/stories.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // infrastructure
    AppConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),

    // global services used across features
    UsersModule,
    FollowsModule,
    RealtimeModule,
    NotificationsModule,
    PushModule,

    // features
    AuthModule,
    SettingsModule,
    SearchModule,
    MediaModule,
    PostsModule,
    LikesModule,
    CommentsModule,
    StoriesModule,
    ConversationsModule,
    MessagesModule,
    CallsModule,
    LivesModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
