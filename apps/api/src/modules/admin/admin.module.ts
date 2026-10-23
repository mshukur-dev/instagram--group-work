import { Module } from '@nestjs/common';
import { CommentsModule } from '../comments/comments.module';
import { LivesModule } from '../lives/lives.module';
import { PostsModule } from '../posts/posts.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/** Admin panel: dashboard, users and bans, content moderation, audit log (ADMIN-*). */
@Module({
  imports: [PostsModule, CommentsModule, LivesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
