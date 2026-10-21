import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import {
  ErrorCode,
  type MediaFolder,
  type MediaSignature,
  type MediaSignatureInput,
  type UploadedMedia,
} from '@instagram/shared';
import { badRequest, serviceUnavailable } from '../../common/errors/app-exception';
import { AppConfigService } from '../../config/app-config.service';

/** Root folder of the project in Cloudinary: every public_id we accept starts with it. */
export const MEDIA_ROOT = 'instagram';

export type UploadedMediaRules = {
  /** Folders the files may come from, e.g. ['posts', 'reels'] */
  folders: readonly MediaFolder[];
  /** Max video length in seconds (checked against `duration` returned by Cloudinary) */
  maxVideoSeconds: number;
};

/**
 * Cloudinary integration (docs/spec/media.md): signs direct uploads from the browser,
 * checks what the client reports after an upload, deletes files in the background.
 * Without Cloudinary keys signing returns 503 and deleting is a no-op.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(private readonly config: AppConfigService) {
    if (config.isCloudinaryEnabled) {
      cloudinary.config({
        cloud_name: config.get('CLOUDINARY_CLOUD_NAME'),
        api_key: config.get('CLOUDINARY_API_KEY'),
        api_secret: config.get('CLOUDINARY_API_SECRET'),
        secure: true,
      });
    }
  }

  /** Signature for POST https://api.cloudinary.com/v1_1/<cloud>/auto/upload */
  sign(input: MediaSignatureInput): MediaSignature {
    const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      throw serviceUnavailable('Media uploads are not configured.');
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = `${MEDIA_ROOT}/${input.folder}`;
    const params: Record<string, string | number> = { timestamp, folder };
    if (input.transformation) params.transformation = input.transformation;

    return {
      signature: cloudinary.utils.api_sign_request(params, apiSecret),
      timestamp,
      apiKey,
      cloudName,
      folder,
      ...(input.transformation ? { transformation: input.transformation } : {}),
    };
  }

  /**
   * Checks media the client got back from Cloudinary before saving it:
   * public_id inside one of the allowed folders, URL from our cloud, video length.
   */
  assertUploaded(items: UploadedMedia[], rules: UploadedMediaRules): void {
    const prefixes = rules.folders.map((f) => `${MEDIA_ROOT}/${f}/`);
    const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME');

    for (const item of items) {
      if (!prefixes.some((p) => item.publicId.startsWith(p)) || item.publicId.includes('..')) {
        throw badRequest(
          ErrorCode.INVALID_MEDIA,
          'This file was not uploaded to an allowed folder.',
        );
      }
      // With real keys the file must live in our cloud; in dev/tests any URL is fine.
      if (cloudName && !item.url.startsWith(`https://res.cloudinary.com/${cloudName}/`)) {
        throw badRequest(ErrorCode.INVALID_MEDIA, 'This file was not uploaded to our storage.');
      }
      if (item.type === 'VIDEO' && item.duration && item.duration > rules.maxVideoSeconds) {
        throw badRequest(
          ErrorCode.INVALID_MEDIA,
          `Videos can be at most ${rules.maxVideoSeconds} seconds long.`,
        );
      }
    }
  }

  /**
   * Deletes files from Cloudinary in the background — never awaited by request handlers.
   * Ids outside our folder (seed data) are skipped. Videos need resource_type 'video',
   * so if an id is not found as an image it is retried as a video.
   */
  destroy(publicIds: string[]): void {
    if (!this.config.isCloudinaryEnabled) return;
    const ids = [...new Set(publicIds)].filter((id) => id.startsWith(`${MEDIA_ROOT}/`));
    if (ids.length === 0) return;

    void Promise.all(ids.map((id) => this.destroyOne(id))).catch((error: unknown) => {
      this.logger.warn(`Cloudinary destroy failed: ${String(error)}`);
    });
  }

  private async destroyOne(publicId: string): Promise<void> {
    const image = (await cloudinary.uploader.destroy(publicId, { resource_type: 'image' })) as {
      result?: string;
    };
    if (image.result === 'not found') {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    }
  }
}
