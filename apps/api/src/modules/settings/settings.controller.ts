import { Body, Controller, Delete, Get, HttpCode, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  type SessionInfo,
  type Settings,
  type UpdateNotificationSettingsInput,
  updateNotificationSettingsSchema,
  type UpdateSettingsInput,
  updateSettingsSchema,
} from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<Settings> {
    return this.settingsService.get(user.id);
  }

  @Patch()
  @ApiZodBody(updateSettingsSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateSettingsSchema)) dto: UpdateSettingsInput,
  ): Promise<Settings> {
    return this.settingsService.update(user.id, dto);
  }

  @Patch('notifications')
  @ApiZodBody(updateNotificationSettingsSchema)
  updateNotifications(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateNotificationSettingsSchema))
    dto: UpdateNotificationSettingsInput,
  ): Promise<Settings> {
    return this.settingsService.updateNotifications(user.id, dto);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser): Promise<SessionInfo[]> {
    return this.settingsService.listSessions(user.id, user.sessionId);
  }

  @Delete('sessions')
  @HttpCode(204)
  deleteOtherSessions(@CurrentUser() user: AuthUser): Promise<void> {
    return this.settingsService.deleteOtherSessions(user.id, user.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  deleteSession(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.settingsService.deleteSession(user.id, id);
  }
}
