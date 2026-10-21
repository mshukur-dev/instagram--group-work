import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/** /search/* — users, hashtags, recent searches. /explore and /hashtags/* live in the posts module. */
@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
