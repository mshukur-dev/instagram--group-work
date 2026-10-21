import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type CreateHighlightInput,
  createHighlightSchema,
  type Highlight,
  type Story,
  type UpdateHighlightInput,
  updateHighlightSchema,
} from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { HighlightsService } from './highlights.service';

@ApiTags('highlights')
@Controller('highlights')
export class HighlightsController {
  constructor(private readonly highlightsService: HighlightsService) {}

  @Post()
  @ApiZodBody(createHighlightSchema)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createHighlightSchema)) dto: CreateHighlightInput,
  ): Promise<Highlight> {
    return this.highlightsService.create(user.id, dto);
  }

  @Patch(':id')
  @ApiZodBody(updateHighlightSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateHighlightSchema)) dto: UpdateHighlightInput,
  ): Promise<Highlight> {
    return this.highlightsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.highlightsService.remove(user.id, id);
  }

  @Get(':id/stories')
  stories(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Story[]> {
    return this.highlightsService.listStories(user.id, id);
  }
}
