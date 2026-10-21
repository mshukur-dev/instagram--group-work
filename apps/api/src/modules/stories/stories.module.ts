import { Module } from '@nestjs/common';
import { HighlightsController } from './highlights.controller';
import { HighlightsService } from './highlights.service';
import { StoriesController, UserStoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  controllers: [StoriesController, UserStoriesController, HighlightsController],
  providers: [StoriesService, HighlightsService],
  exports: [StoriesService],
})
export class StoriesModule {}
