import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { type Profile, Strategy } from 'passport-google-oauth20';
import { AppConfigService } from '../../../config/app-config.service';

export type GoogleProfile = {
  googleId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
};

/**
 * Registered only when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set (see AuthModule).
 * The callback URL goes through the web origin so cookies land on the frontend domain.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: AppConfigService) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID') ?? '',
      clientSecret: config.get('GOOGLE_CLIENT_SECRET') ?? '',
      callbackURL: config.get('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile): GoogleProfile | false {
    const email = profile.emails?.find((e) => e.verified)?.value ?? profile.emails?.[0]?.value;
    if (!email) return false;
    return {
      googleId: profile.id,
      email: email.toLowerCase(),
      fullName: profile.displayName || email.split('@')[0] || 'Instagram user',
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
  }
}
