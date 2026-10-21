import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env';

/** Typed access to environment variables: `config.get('WEB_URL')`. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get isGoogleEnabled(): boolean {
    return Boolean(this.get('GOOGLE_CLIENT_ID') && this.get('GOOGLE_CLIENT_SECRET'));
  }

  get isCloudinaryEnabled(): boolean {
    return Boolean(
      this.get('CLOUDINARY_CLOUD_NAME') &&
        this.get('CLOUDINARY_API_KEY') &&
        this.get('CLOUDINARY_API_SECRET'),
    );
  }

  get isPushEnabled(): boolean {
    return Boolean(this.get('VAPID_PUBLIC_KEY') && this.get('VAPID_PRIVATE_KEY'));
  }
}
