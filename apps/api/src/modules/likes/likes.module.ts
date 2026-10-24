import { Module } from '@nestjs/common';
import { CommentsModule } from '../comments/comments.module';
import { PostsModule } from '../posts/posts.module';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';

/** Post likes, comment likes and saves (ENGAGE-1, ENGAGE-4, ENGAGE-6, ENGAGE-7). */
@Module({
  imports: [PostsModule, CommentsModule],
  controllers: [LikesController],
  providers: [LikesService],
  exports: [LikesService],
})
export class LikesModule {}
