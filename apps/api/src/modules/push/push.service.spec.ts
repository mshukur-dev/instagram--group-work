import { sendNotification } from 'web-push';
import type { PushPayload } from '@instagram/shared';
import type { AppConfigService } from '../../config/app-config.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { PushService } from './push.service';

jest.mock('web-push', () => ({ sendNotification: jest.fn() }));

const sendMock = sendNotification as jest.MockedFunction<typeof sendNotification>;

const payload = (language: string): PushPayload => ({
  type: 'NOTIFICATION',
  title: 'Instagram',
  body: language,
  icon: null,
  url: '/',
  tag: 't',
});

type Settings = {
  pushEnabled: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  messages: boolean;
  calls: boolean;
  pausedUntil: Date | null;
};

const defaults: Settings = {
  pushEnabled: true,
  likes: true,
  comments: true,
  follows: true,
  messages: true,
  calls: true,
  pausedUntil: null,
};

function setup(
  opts: { enabled?: boolean; settings?: Partial<Settings> | null; subs?: number } = {},
) {
  const user = {
    language: 'RU',
    notificationSettings: opts.settings === null ? null : { ...defaults, ...opts.settings },
    pushSubscriptions: Array.from({ length: opts.subs ?? 2 }, (_, i) => ({
      endpoint: `https://push.example.com/${i}`,
      p256dh: 'p',
      auth: 'a',
    })),
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    pushSubscription: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const config = {
    isPushEnabled: opts.enabled ?? true,
    get: jest.fn((key: string) => (key === 'VAPID_SUBJECT' ? 'mailto:x@y.z' : 'key')),
  };
  const realtime = new RealtimeService();
  const service = new PushService(
    prisma as unknown as PrismaService,
    config as unknown as AppConfigService,
    realtime,
  );
  return { service, prisma, realtime };
}

describe('PushService', () => {
  beforeEach(() =>
    sendMock.mockReset().mockResolvedValue({ statusCode: 201, body: '', headers: {} }),
  );

  it('sends the payload in the recipient language to every subscription', async () => {
    const { service } = setup();
    await service.send('u1', 'likes', payload);
    expect(sendMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(sendMock.mock.calls[0]?.[1] as string) as PushPayload;
    expect(body.body).toBe('RU');
  });

  it('uses defaults when the user has no settings row', async () => {
    const { service } = setup({ settings: null });
    await service.send('u1', 'calls', payload);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['push disabled', { pushEnabled: false }],
    ['category off', { likes: false }],
    ['paused', { pausedUntil: new Date(Date.now() + 60_000) }],
  ])('skips when %s', async (_, settings) => {
    const { service } = setup({ settings });
    await service.send('u1', 'likes', payload);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends again after the pause is over', async () => {
    const { service } = setup({ settings: { pausedUntil: new Date(Date.now() - 1000) } });
    await service.send('u1', 'likes', payload);
    expect(sendMock).toHaveBeenCalled();
  });

  it('deletes subscriptions rejected with 404/410 and keeps others', async () => {
    const { service, prisma } = setup({ subs: 3 });
    sendMock
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error('server'), { statusCode: 500 }));
    await service.send('u1', 'likes', payload);
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: { in: ['https://push.example.com/0'] } },
    });
  });

  it('notify is a no-op without VAPID keys', () => {
    const { service, prisma } = setup({ enabled: false });
    service.notify('u1', 'likes', payload);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('notify skips users with a focused tab', () => {
    const { service, prisma, realtime } = setup();
    realtime.addSocket('u1', 's1');
    service.notify('u1', 'likes', payload);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('notify never throws', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockRejectedValue(new Error('db down'));
    expect(() => service.notify('u1', 'likes', payload)).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
  });
});
