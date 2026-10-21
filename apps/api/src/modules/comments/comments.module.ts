import { Module } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

/** Comments and one level of replies (ENGAGE-2, ENGAGE-3, ENGAGE-5). */
@Module({
  imports: [PostsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
