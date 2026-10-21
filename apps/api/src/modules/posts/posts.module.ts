import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { FeedService } from './feed.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { ProfilePostsController } from './profile-posts.controller';

/** Posts, reels, feed, explore, hashtags and profile grids. Exports PostsService (contract). */
@Module({
  imports: [MediaModule],
  controllers: [PostsController, ProfilePostsController],
  providers: [PostsService, FeedService],
  exports: [PostsService],
})
export class PostsModule {}
