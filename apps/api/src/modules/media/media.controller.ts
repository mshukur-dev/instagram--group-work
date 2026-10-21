import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  mediaSignatureSchema,
  type MediaSignature,
  type MediaSignatureInput,
} from '@instagram/shared';
import { ApiZodBody } from '../../common/decorators/api-zod-body.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MediaService } from './media.service';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /** Any authenticated user may upload: the signature is bound to our folder. */
  @Post('signature')
  @HttpCode(200)
  @ApiZodBody(mediaSignatureSchema)
  signature(
    @Body(new ZodValidationPipe(mediaSignatureSchema)) dto: MediaSignatureInput,
  ): MediaSignature {
    return this.mediaService.sign(dto);
  }
}
