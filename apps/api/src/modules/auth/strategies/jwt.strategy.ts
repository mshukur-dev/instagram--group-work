import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../../config/app-config.service';
import type { AuthUser } from '../../../common/types';
import { ACCESS_COOKIE } from '../auth.cookies';
import type { AccessPayload } from '../tokens.service';

const fromCookie = (req: Request): string | null =>
  (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE] ?? null;

/**
 * Reads the access token from the httpOnly cookie (browser)
 * or the Authorization header (Swagger "Authorize" button, tests).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        fromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: AccessPayload): AuthUser {
    return { id: payload.sub, username: payload.username, sessionId: payload.sid };
  }
}
