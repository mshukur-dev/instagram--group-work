import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Count, Notification, Page } from '@instagram/shared';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Notifications and push subscription endpoints.
 * Requires a running database (pnpm db:up) with migrations applied.
 */
describe('Notifications & push (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notifications: NotificationsService;
  const suffix = Date.now().toString(36);
  const names = { me: `nt_m_${suffix}`, actor: `nt_a_${suffix}`, blocked: `nt_b_${suffix}` };
  const agents: Record<keyof typeof names, request.Agent> = {} as never;
  const ids: Record<keyof typeof names, string> = {} as never;
  const endpoint = `https://fcm.googleapis.com/fcm/send/e2e-${suffix}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    notifications = app.get(NotificationsService);

    for (const key of Object.keys(names) as (keyof typeof names)[]) {
      const agent = request.agent(app.getHttpServer());
      const res = await agent
        .post('/api/auth/register')
        .send({
          email: `${names[key]}@example.com`,
          fullName: key,
          username: names[key],
          password: 'password123',
        })
        .expect(201);
      agents[key] = agent;
      ids[key] = (res.body as { id: string }).id;
    }
    await prisma.block.create({ data: { blockerId: ids.me, blockedId: ids.blocked } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { username: { in: Object.values(names) } } });
    await app.close();
  });

  it('creates notifications, skipping self, blocked users and duplicates', async () => {
    await notifications.create({ recipientId: ids.me, actorId: ids.actor, type: 'FOLLOW' });
    await notifications.create({ recipientId: ids.me, actorId: ids.actor, type: 'FOLLOW' });
    await notifications.create({ recipientId: ids.me, actorId: ids.me, type: 'FOLLOW' });
    await notifications.create({ recipientId: ids.me, actorId: ids.blocked, type: 'FOLLOW' });
    await notifications.create({ recipientId: ids.me, actorId: ids.actor, type: 'FOLLOW_REQUEST' });

    const page = (await agents.me.get('/api/notifications').expect(200)).body as Page<Notification>;
    expect(page.items.map((n) => n.type)).toEqual(['FOLLOW_REQUEST', 'FOLLOW']);
    expect(page.items[0]).toMatchObject({
      actor: { id: ids.actor, username: names.actor },
      actorFollowStatus: 'NONE',
      post: null,
      comment: null,
      isRead: false,
    });
  });

  it('paginates with a cursor', async () => {
    const first = (await agents.me.get('/api/notifications?limit=1').expect(200))
      .body as Page<Notification>;
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).not.toBeNull();
    const second = (
      await agents.me.get(`/api/notifications?limit=1&cursor=${first.nextCursor}`).expect(200)
    ).body as Page<Notification>;
    expect(second.items[0]?.type).toBe('FOLLOW');
    expect(second.nextCursor).toBeNull();
  });

  it('counts unread and marks all as read', async () => {
    let count = (await agents.me.get('/api/notifications/unread-count').expect(200)).body as Count;
    expect(count.count).toBe(2);
    await agents.me.post('/api/notifications/read-all').expect(204);
    count = (await agents.me.get('/api/notifications/unread-count').expect(200)).body as Count;
    expect(count.count).toBe(0);
  });

  it('removes notifications by the provided fields', async () => {
    await notifications.remove({ recipientId: ids.me, actorId: ids.actor, type: 'FOLLOW_REQUEST' });
    const page = (await agents.me.get('/api/notifications').expect(200)).body as Page<Notification>;
    expect(page.items.map((n) => n.type)).toEqual(['FOLLOW']);
  });

  it('returns the VAPID public key', async () => {
    const res = await agents.me.get('/api/push/vapid-public-key').expect(200);
    expect(typeof res.body.key).toBe('string');
  });

  it('subscribes (upsert by endpoint) and unsubscribes', async () => {
    const body = { endpoint, keys: { p256dh: 'p256dh-key', auth: 'auth-key' } };
    await agents.me.post('/api/push/subscriptions').send(body).expect(204);
    // The same browser re-subscribes under another account: the row moves
    await agents.actor
      .post('/api/push/subscriptions')
      .send({ ...body, keys: { p256dh: 'new', auth: 'new' } })
      .expect(204);
    const rows = await prisma.pushSubscription.findMany({ where: { endpoint } });
    expect(rows).toEqual([expect.objectContaining({ userId: ids.actor, p256dh: 'new' })]);

    const invalid = await agents.me.post('/api/push/subscriptions').send({ endpoint }).expect(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');

    await agents.actor.delete('/api/push/subscriptions').send({ endpoint }).expect(204);
    expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(0);
  });

  it('requires auth', async () => {
    await request(app.getHttpServer()).get('/api/notifications').expect(401);
  });
});
