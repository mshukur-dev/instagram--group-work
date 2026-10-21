import { Body, Controller, Delete, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  type PushSubscriptionInput,
  pushSubscriptionSchema,
  type PushUnsubscribeInput,
  pushUnsubscribeSchema,
} from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { serviceUnavailable } from '../../common/errors/app-exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { PushService } from './push.service';

@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('vapid-public-key')
  vapidPublicKey(): { key: string } {
    const key = this.pushService.getPublicKey();
    if (!key) throw serviceUnavailable('Push notifications are not configured.');
    return { key };
  }

  @Post('subscriptions')
  @HttpCode(204)
  @ApiZodBody(pushSubscriptionSchema)
  async subscribe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(pushSubscriptionSchema)) dto: PushSubscriptionInput,
    @Req() req: Request,
  ): Promise<void> {
    await this.pushService.subscribe(user.id, dto, req.headers['user-agent']);
  }

  @Delete('subscriptions')
  @HttpCode(204)
  @ApiZodBody(pushUnsubscribeSchema)
  async unsubscribe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(pushUnsubscribeSchema)) dto: PushUnsubscribeInput,
  ): Promise<void> {
    await this.pushService.unsubscribe(user.id, dto.endpoint);
  }
}
