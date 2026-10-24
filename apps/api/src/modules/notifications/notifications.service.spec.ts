import { type Language, type Notification, NotificationType, ServerEvent } from '@instagram/shared';
import type { PrismaService } from '../../prisma/prisma.service';
import type { FollowsService } from '../follows/follows.service';
import type { PushService } from '../push/push.service';
import { pushMessages } from '../push/push-messages';
import type { RealtimeService } from '../realtime/realtime.service';
import type { UserPreviewService } from '../users/user-preview.service';
import { buildNotificationPush, NotificationsService } from './notifications.service';

const actor = { id: 'a', username: 'ivan', fullName: 'Ivan', avatarUrl: null };

function setup() {
  const prisma = {
    notification: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: { data: object }) => ({
        id: 'n1',
        isRead: false,
        createdAt: new Date(),
        ...data,
      })),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { findMany: jest.fn().mockResolvedValue([actor]) },
    post: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 'p1', type: 'POST', media: [{ url: 'https://img/1.jpg', thumbnailUrl: null }] },
        ]),
    },
    comment: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const follows = {
    isBlockedBetween: jest.fn().mockResolvedValue(false),
    getFollowStatuses: jest.fn().mockResolvedValue(new Map([['a', 'ACCEPTED']])),
  };
  const userPreview = {
    build: jest
      .fn()
      .mockResolvedValue(
        new Map([['a', { ...actor, hasActiveStory: false, hasUnseenStory: false }]]),
      ),
  };
  const realtime = { emitToUser: jest.fn() };
  const push = { notify: jest.fn() };
  const service = new NotificationsService(
    prisma as unknown as PrismaService,
    follows as unknown as FollowsService,
    userPreview as unknown as UserPreviewService,
    realtime as unknown as RealtimeService,
    push as unknown as PushService,
  );
  return { service, prisma, follows, realtime, push };
}

const like = { recipientId: 'r', actorId: 'a', type: NotificationType.POST_LIKE, postId: 'p1' };

describe('NotificationsService.create', () => {
  it('saves, emits notification:new and sends a push in the likes category', async () => {
    const { service, prisma, realtime, push } = setup();
    await service.create(like);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { ...like, commentId: null, storyId: null },
    });
    expect(realtime.emitToUser).toHaveBeenCalledWith(
      'r',
      ServerEvent.NOTIFICATION_NEW,
      expect.objectContaining({
        id: 'n1',
        actorFollowStatus: 'ACCEPTED',
        post: { id: 'p1', type: 'POST', thumbnailUrl: 'https://img/1.jpg' },
      }),
    );
    expect(push.notify).toHaveBeenCalledWith('r', 'likes', expect.any(Function));
  });

  it('skips the actor’s own actions', async () => {
    const { service, prisma } = setup();
    await service.create({ ...like, recipientId: 'a' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('skips blocked users', async () => {
    const { service, prisma, follows } = setup();
    follows.isBlockedBetween.mockResolvedValue(true);
    await service.create(like);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('dedupes an identical unread notification', async () => {
    const { service, prisma, push } = setup();
    prisma.notification.findFirst.mockResolvedValue({ id: 'old' });
    await service.create(like);
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(push.notify).not.toHaveBeenCalled();
  });

  it('never throws', async () => {
    const { service, prisma } = setup();
    prisma.notification.create.mockRejectedValue(new Error('db down'));
    await expect(service.create(like)).resolves.toBeUndefined();
  });
});

describe('NotificationsService.remove', () => {
  it('matches only the provided fields', async () => {
    const { service, prisma } = setup();
    await service.remove({ recipientId: 'r', actorId: 'a', type: NotificationType.FOLLOW });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        recipientId: 'r',
        actorId: 'a',
        type: 'FOLLOW',
        postId: undefined,
        commentId: undefined,
        storyId: undefined,
      },
    });
  });
});

describe('buildNotificationPush', () => {
  const base: Notification = {
    id: 'n1',
    type: 'POST_LIKE',
    actor: {
      ...actor,
      avatarUrl: 'https://a.png',
      isVerified: false,
      hasActiveStory: false,
      hasUnseenStory: false,
    },
    post: { id: 'p1', type: 'POST', thumbnailUrl: null },
    comment: null,
    storyId: null,
    actorFollowStatus: 'NONE',
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  it('builds localized texts and links', () => {
    expect(buildNotificationPush(base, 'EN')).toMatchObject({
      type: 'NOTIFICATION',
      body: 'ivan liked your post.',
      url: '/p/p1',
      icon: 'https://a.png',
    });
    expect(buildNotificationPush(base, 'RU').body).toBe('ivan нравится ваша публикация.');
    const reel = { ...base, post: { id: 'r1', type: 'REEL' as const, thumbnailUrl: null } };
    expect(buildNotificationPush(reel, 'EN')).toMatchObject({
      body: 'ivan liked your reel.',
      url: '/reel/r1',
    });
    const follow = { ...base, type: 'FOLLOW' as const, post: null };
    expect(buildNotificationPush(follow, 'EN').url).toBe('/ivan');
  });

  it('truncates long comment texts', () => {
    const comment = {
      ...base,
      type: 'COMMENT' as const,
      comment: { id: 'c', text: 'x'.repeat(500) },
    };
    expect(buildNotificationPush(comment, 'EN').body.length).toBeLessThan(130);
  });

  it('has a template for every notification type in every language', () => {
    for (const language of Object.keys(pushMessages) as Language[]) {
      for (const type of Object.values(NotificationType)) {
        expect(pushMessages[language][type]({ actor: 'ivan', text: 'hi' })).toContain('ivan');
      }
    }
  });
});
