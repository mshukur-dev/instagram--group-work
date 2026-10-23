import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
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
  constructor(
    config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        fromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * The session must still exist and the user must not be banned: logging out a device
   * (SETTINGS-5) or a ban (ADMIN-4) takes effect at once, not when the access token expires.
   * Returning null makes JwtAuthGuard answer 401.
   */
  async validate(payload: AccessPayload): Promise<AuthUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      select: { userId: true, user: { select: { role: true, bannedAt: true } } },
    });
    if (!session || session.userId !== payload.sub || session.user.bannedAt) return null;
    return {
      id: payload.sub,
      username: payload.username,
      sessionId: payload.sid,
      role: session.user.role,
    };
  }
}
