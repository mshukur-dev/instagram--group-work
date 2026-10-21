import { Body, Controller, HttpCode, Param, Post, type RawBodyRequest, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { type CallJoin, type StartCallInput, startCallSchema } from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { unauthorized } from '../../common/errors/app-exception';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types';
import { CallsService } from './calls.service';

@ApiTags('calls')
@Controller()
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Post('conversations/:id/calls')
  @ApiZodBody(startCallSchema)
  start(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(startCallSchema)) dto: StartCallInput,
  ): Promise<CallJoin> {
    return this.calls.start(user.id, id, dto.type);
  }

  @Post('calls/:id/join')
  @HttpCode(200)
  join(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<CallJoin> {
    return this.calls.join(user.id, id);
  }

  @Post('calls/:id/decline')
  @HttpCode(204)
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.calls.decline(user.id, id);
  }

  @Post('calls/:id/leave')
  @HttpCode(204)
  leave(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.calls.leave(user.id, id);
  }

  /** Signed by LiveKit; verified against the raw body (calls.md §7). */
  @Public()
  @SkipThrottle()
  @ApiExcludeEndpoint()
  @Post('calls/livekit-webhook')
  @HttpCode(204)
  async webhook(@Req() req: RawBodyRequest<Request>): Promise<void> {
    let body: string;
    if (req.rawBody) body = req.rawBody.toString('utf8');
    else if (req.readableEnded)
      body = JSON.stringify(req.body ?? {}); // parsed without rawBody
    else body = await readBody(req);
    const auth = req.headers.authorization ?? headerValue(req.headers.authorize);
    if (!(await this.calls.handleWebhook(body, auth))) throw unauthorized();
  }
}

/**
 * LiveKit posts `application/webhook+json`, which the JSON parser skips,
 * so the stream is still unread and we read it here.
 */
function readBody(req: Request): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const headerValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
