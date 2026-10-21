import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../config/app-config.service';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS, SOCKET_TTL_SECONDS } from './auth.cookies';

export type AccessPayload = { sub: string; username: string; sid: string };
export type RefreshPayload = { sub: string; sid: string; jti: string };
export type SocketPayload = { sub: string };

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  signAccess(payload: AccessPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TTL_SECONDS,
    });
  }

  /** Each refresh token has a random jti, so rotation always produces a new hash. */
  signRefresh(userId: string, sessionId: string): Promise<string> {
    const payload: RefreshPayload = {
      sub: userId,
      sid: sessionId,
      jti: randomBytes(16).toString('hex'),
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: REFRESH_TTL_SECONDS,
    });
  }

  signSocket(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId } satisfies SocketPayload, {
      secret: this.config.get('JWT_SOCKET_SECRET'),
      expiresIn: SOCKET_TTL_SECONDS,
    });
  }

  async verifyRefresh(token: string): Promise<RefreshPayload | null> {
    try {
      return await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      return null;
    }
  }

  async verifySocket(token: string): Promise<SocketPayload | null> {
    try {
      return await this.jwt.verifyAsync<SocketPayload>(token, {
        secret: this.config.get('JWT_SOCKET_SECRET'),
      });
    } catch {
      return null;
    }
  }

  /** Refresh tokens are long random JWTs, so a fast SHA-256 is enough (no argon2 needed). */
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
