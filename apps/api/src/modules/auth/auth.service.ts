import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ErrorCode, type LoginInput, type Me, type RegisterInput } from '@instagram/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { conflict, unauthorized } from '../../common/errors/app-exception';
import { UsersService } from '../users/users.service';
import { REFRESH_TTL_SECONDS } from './auth.cookies';
import type { GoogleProfile } from './strategies/google.strategy';
import { TokensService } from './tokens.service';

export type ClientInfo = { userAgent?: string; ip?: string };
export type AuthTokens = { accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly users: UsersService,
  ) {}

  async register(dto: RegisterInput, client: ClientInfo): Promise<{ me: Me; tokens: AuthTokens }> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { email: true, username: true },
    });
    if (existing?.email === dto.email) {
      throw conflict(ErrorCode.EMAIL_TAKEN, 'Another account is using the same email.');
    }
    if (existing?.username === dto.username) {
      throw conflict(ErrorCode.USERNAME_TAKEN, "This username isn't available.");
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        fullName: dto.fullName,
        passwordHash: await argon2.hash(dto.password),
        notificationSettings: { create: {} },
      },
    });

    const tokens = await this.createSession(user.id, user.username, client);
    return { me: await this.users.getMe(user.id), tokens };
  }

  async login(dto: LoginInput, client: ClientInfo): Promise<{ me: Me; tokens: AuthTokens }> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.login }, { username: dto.login }] },
    });
    // Same error for "no such user", "wrong password" and "Google-only account"
    const valid =
      user?.passwordHash != null && (await argon2.verify(user.passwordHash, dto.password));
    if (!user || !valid) {
      throw unauthorized(ErrorCode.INVALID_CREDENTIALS, 'Incorrect username or password.');
    }

    const tokens = await this.createSession(user.id, user.username, client);
    return { me: await this.users.getMe(user.id), tokens };
  }

  /**
   * Finds or creates the user for a Google profile:
   * by googleId → by email (links Google) → new user with a generated username.
   */
  async loginWithGoogle(
    profile: GoogleProfile,
    client: ClientInfo,
  ): Promise<{ tokens: AuthTokens; isNew: boolean }> {
    let user =
      (await this.prisma.user.findUnique({ where: { googleId: profile.googleId } })) ??
      (await this.prisma.user.findUnique({ where: { email: profile.email } }));
    let isNew = false;

    if (user && !user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId, avatarUrl: user.avatarUrl ?? profile.avatarUrl },
      });
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          googleId: profile.googleId,
          fullName: profile.fullName.slice(0, 64),
          avatarUrl: profile.avatarUrl,
          username: await this.generateUsername(profile.email),
          notificationSettings: { create: {} },
        },
      });
      isNew = true;
    }

    return { tokens: await this.createSession(user.id, user.username, client), isNew };
  }

  /** Rotates the refresh token. Reuse of an old token kills the session. */
  async refresh(refreshToken: string | undefined, client: ClientInfo): Promise<AuthTokens> {
    const invalid = () => unauthorized(ErrorCode.INVALID_REFRESH_TOKEN, 'Please log in again.');
    if (!refreshToken) throw invalid();

    const payload = await this.tokens.verifyRefresh(refreshToken);
    if (!payload) throw invalid();

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: { select: { username: true } } },
    });
    if (!session || session.expiresAt < new Date()) throw invalid();

    if (session.refreshTokenHash !== this.tokens.hash(refreshToken)) {
      // Token reuse: someone may have stolen an old refresh token
      await this.prisma.session.delete({ where: { id: session.id } });
      throw invalid();
    }

    const tokens = await this.issueTokens(session.userId, session.user.username, session.id);
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.tokens.hash(tokens.refreshToken),
        lastUsedAt: new Date(),
        userAgent: client.userAgent ?? session.userAgent,
        ip: client.ip ?? session.ip,
      },
    });
    return tokens;
  }

  /** Works even with an expired access token: the session is found via the refresh token. */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const payload = await this.tokens.verifyRefresh(refreshToken);
    if (payload) await this.prisma.session.deleteMany({ where: { id: payload.sid } });
  }

  socketToken(userId: string): Promise<string> {
    return this.tokens.signSocket(userId);
  }

  private async createSession(
    userId: string,
    username: string,
    client: ClientInfo,
  ): Promise<AuthTokens> {
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: 'pending',
        userAgent: client.userAgent?.slice(0, 500),
        ip: client.ip,
        expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      },
    });
    const tokens = await this.issueTokens(userId, username, session.id);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: this.tokens.hash(tokens.refreshToken) },
    });
    return tokens;
  }

  private async issueTokens(userId: string, username: string, sessionId: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccess({ sub: userId, username, sid: sessionId }),
      this.tokens.signRefresh(userId, sessionId),
    ]);
    return { accessToken, refreshToken };
  }

  /** ivan.petrov@gmail.com → ivan.petrov, or ivan.petrov_4821 if taken. */
  private async generateUsername(email: string): Promise<string> {
    const base =
      (email.split('@')[0] ?? 'user')
        .toLowerCase()
        .replace(/[^a-z0-9._]/g, '')
        .replace(/\.{2,}/g, '.')
        .replace(/^\.+|\.+$/g, '')
        .slice(0, 24) || 'user';
    const padded = base.length >= 3 ? base : `${base}_ig`;

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate =
        attempt === 0 ? padded : `${padded}_${Math.floor(1000 + Math.random() * 9000)}`;
      const taken = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return `user_${Date.now().toString(36)}`;
  }
}
