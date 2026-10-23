import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { LiveJoin, LiveStream } from '@instagram/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types';
import { LivesService } from './lives.service';

@ApiTags('lives')
@Controller()
export class LivesController {
  constructor(private readonly lives: LivesService) {}

  /** Go live (or rejoin my running live) */
  @Post('lives')
  start(@CurrentUser() user: AuthUser): Promise<LiveJoin> {
    return this.lives.start(user.id);
  }

  /** Lives of people I follow and my own, for the LIVE rings */
  @Get('lives')
  following(@CurrentUser() user: AuthUser): Promise<LiveStream[]> {
    return this.lives.following(user.id);
  }

  @Get('users/:username/live')
  byUsername(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
  ): Promise<LiveStream> {
    return this.lives.byUsername(user.id, username);
  }

  @Post('lives/:id/join')
  @HttpCode(200)
  join(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<LiveJoin> {
    return this.lives.join(user.id, id);
  }

  @Post('lives/:id/end')
  @HttpCode(204)
  end(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.lives.end(user.id, id);
  }
}
