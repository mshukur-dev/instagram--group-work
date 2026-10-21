import { Module } from '@nestjs/common';
import { StoriesService } from './stories.service';

@Module({
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}
