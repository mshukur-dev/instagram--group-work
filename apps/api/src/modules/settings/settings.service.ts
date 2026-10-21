import { Injectable } from '@nestjs/common';
import type { NotificationSettings, User } from '@prisma/client';
import { UAParser } from 'ua-parser-js';
import {
  ErrorCode,
  type SessionInfo,
  type Settings,
  type UpdateNotificationSettingsInput,
  type UpdateSettingsInput,
} from '@instagram/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { notFound } from '../../common/errors/app-exception';
import { UsersService } from '../users/users.service';

/** SETTINGS-2, 3, 5, 6, 10. Profile and password are changed via /users/me. */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async get(userId: string): Promise<Settings> {
    const [user, notifications] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.notificationSettings(userId),
    ]);
    if (!user) throw notFound(ErrorCode.USER_NOT_FOUND, 'User not found.');
    return toSettings(user, notifications);
  }

  /** isPrivate goes through UsersService so that going public accepts pending requests. */
  async update(userId: string, dto: UpdateSettingsInput): Promise<Settings> {
    await this.users.updateUser(userId, dto);
    return this.get(userId);
  }

  /** pauseHours: 0 resumes pushes, 1/8/24 pauses them for that long. */
  async updateNotifications(
    userId: string,
    dto: UpdateNotificationSettingsInput,
  ): Promise<Settings> {
    const { pauseHours, ...flags } = dto;
    const data = {
      ...flags,
      ...(pauseHours === undefined
        ? {}
        : {
            pausedUntil: pauseHours === 0 ? null : new Date(Date.now() + pauseHours * 3_600_000),
          }),
    };
    await this.prisma.notificationSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.get(userId);
  }

  /** Active sessions, most recently used first. */
  async listSessions(userId: string, currentSessionId: string): Promise<SessionInfo[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, userAgent: true, lastUsedAt: true, createdAt: true },
    });
    const items = sessions.map((s) => ({
      id: s.id,
      ...parseUserAgent(s.userAgent),
      lastUsedAt: s.lastUsedAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      isCurrent: s.id === currentSessionId,
    }));
    // Current device always on top
    return [...items.filter((s) => s.isCurrent), ...items.filter((s) => !s.isCurrent)];
  }

  /** Logs out that device: its refresh token stops working. */
  async deleteSession(userId: string, sessionId: string): Promise<void> {
    const { count } = await this.prisma.session.deleteMany({ where: { id: sessionId, userId } });
    if (count === 0) throw notFound(ErrorCode.NOT_FOUND, 'Session not found.');
  }

  /** "Log out of all other sessions". */
  async deleteOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId, id: { not: currentSessionId } } });
  }

  /** Users created before NotificationSettings existed get default settings on first read. */
  private notificationSettings(userId: string): Promise<NotificationSettings> {
    return this.prisma.notificationSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
}

export function toSettings(user: User, n: NotificationSettings): Settings {
  return {
    isPrivate: user.isPrivate,
    showActivityStatus: user.showActivityStatus,
    messagePermission: user.messagePermission,
    theme: user.theme,
    language: user.language,
    hasPassword: user.passwordHash !== null,
    notifications: {
      pushEnabled: n.pushEnabled,
      likes: n.likes,
      comments: n.comments,
      follows: n.follows,
      messages: n.messages,
      calls: n.calls,
      // An expired pause is the same as no pause
      pausedUntil: n.pausedUntil && n.pausedUntil > new Date() ? n.pausedUntil.toISOString() : null,
    },
  };
}

/** "Chrome", "Windows" — or "Unknown" when the user agent is missing or unrecognised. */
export function parseUserAgent(userAgent: string | null): { browser: string; os: string } {
  if (!userAgent) return { browser: 'Unknown', os: 'Unknown' };
  const { browser, os } = UAParser(userAgent);
  return { browser: browser.name ?? 'Unknown', os: os.name ?? 'Unknown' };
}
