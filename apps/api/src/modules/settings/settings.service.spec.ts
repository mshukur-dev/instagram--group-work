import type { NotificationSettings, User } from '@prisma/client';
import { parseUserAgent, toSettings } from './settings.service';

describe('parseUserAgent', () => {
  it('extracts browser and OS names', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Chrome', os: 'Windows' });
  });

  it('falls back to Unknown', () => {
    expect(parseUserAgent(null)).toEqual({ browser: 'Unknown', os: 'Unknown' });
    expect(parseUserAgent('curl-ish')).toEqual({ browser: 'Unknown', os: 'Unknown' });
  });
});

describe('toSettings', () => {
  const user = {
    isPrivate: true,
    showActivityStatus: false,
    messagePermission: 'FOLLOWING',
    theme: 'DARK',
    language: 'RU',
    passwordHash: null,
  } as User;
  const base = {
    userId: 'u',
    pushEnabled: true,
    likes: true,
    comments: false,
    follows: true,
    messages: true,
    calls: true,
    pausedUntil: null,
  } satisfies NotificationSettings;

  it('maps user and notification settings, hasPassword=false for Google-only', () => {
    expect(toSettings(user, base)).toEqual({
      isPrivate: true,
      showActivityStatus: false,
      messagePermission: 'FOLLOWING',
      theme: 'DARK',
      language: 'RU',
      hasPassword: false,
      notifications: {
        pushEnabled: true,
        likes: true,
        comments: false,
        follows: true,
        messages: true,
        calls: true,
        pausedUntil: null,
      },
    });
  });

  it('hides an expired pause', () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 60_000);
    expect(toSettings(user, { ...base, pausedUntil: past }).notifications.pausedUntil).toBeNull();
    expect(toSettings(user, { ...base, pausedUntil: future }).notifications.pausedUntil).toBe(
      future.toISOString(),
    );
  });
});
