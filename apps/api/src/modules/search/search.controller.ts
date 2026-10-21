import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type Hashtag,
  type SearchHistoryInput,
  searchHistorySchema,
  type SearchQuery,
  searchQuerySchema,
  type UserPreview,
} from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('users')
  users(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
  ): Promise<UserPreview[]> {
    return this.searchService.searchUsers(user.id, query);
  }

  @Get('hashtags')
  hashtags(
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
  ): Promise<Hashtag[]> {
    return this.searchService.searchHashtags(query);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser): Promise<UserPreview[]> {
    return this.searchService.getHistory(user.id);
  }

  @Post('history')
  @HttpCode(204)
  @ApiZodBody(searchHistorySchema)
  addToHistory(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(searchHistorySchema)) dto: SearchHistoryInput,
  ): Promise<void> {
    return this.searchService.addToHistory(user.id, dto.userId);
  }

  @Delete('history')
  @HttpCode(204)
  clearHistory(@CurrentUser() user: AuthUser): Promise<void> {
    return this.searchService.clearHistory(user.id);
  }

  @Delete('history/:userId')
  @HttpCode(204)
  removeFromHistory(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.searchService.removeFromHistory(user.id, userId);
  }
}
