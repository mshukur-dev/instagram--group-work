import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type Agent = ReturnType<typeof request.agent>;

/**
 * Users, follows, blocks, search and settings.
 * Requires a running database (pnpm db:up) with migrations applied.
 */
describe('Users, follows, search, settings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = Date.now().toString(36);
  const names = { a: `e2u_${suffix}_a`, b: `e2u_${suffix}_b`, c: `e2u_${suffix}_c` };
  const hashtag = `e2etag${suffix}`;
  const ids: Record<'a' | 'b' | 'c', string> = { a: '', b: '', c: '' };
  const agents = {} as Record<'a' | 'b' | 'c', Agent>;
  const password = 'password123';

  const counters = (key: 'a' | 'b' | 'c') =>
    prisma.user.findUniqueOrThrow({
      where: { id: ids[key] },
      select: { followersCount: true, followingCount: true },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    for (const key of ['a', 'b', 'c'] as const) {
      agents[key] = request.agent(app.getHttpServer());
      const res = await agents[key]
        .post('/api/auth/register')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36')
        .send({
          email: `${names[key]}@example.com`,
          fullName: `E2E ${key.toUpperCase()} ${suffix}`,
          username: names[key],
          password,
        })
        .expect(201);
      ids[key] = res.body.id;
    }
    await prisma.hashtag.create({ data: { name: hashtag, postsCount: 3 } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { username: { startsWith: `e2u_${suffix}` } } });
    await prisma.hashtag.deleteMany({ where: { name: hashtag } });
    await app.close();
  });

  describe('profile', () => {
    it('returns a profile with relationship flags', async () => {
      const res = await agents.a.get(`/api/users/${names.b}`).expect(200);
      expect(res.body).toMatchObject({
        id: ids.b,
        username: names.b,
        isMe: false,
        followStatus: 'NONE',
        followsMe: false,
        isBlocked: false,
        canViewContent: true,
      });
      expect(res.body.email).toBeUndefined();
      const me = await agents.a.get(`/api/users/${names.a}`).expect(200);
      expect(me.body.isMe).toBe(true);
    });

    it('returns USER_NOT_FOUND for an unknown username', async () => {
      const res = await agents.a.get(`/api/users/nobody_${suffix}`).expect(404);
      expect(res.body.code).toBe('USER_NOT_FOUND');
    });

    it('edits the profile and rejects a taken username', async () => {
      const res = await agents.a
        .patch('/api/users/me')
        .send({ bio: 'Hello', website: '' })
        .expect(200);
      expect(res.body).toMatchObject({ bio: 'Hello', website: null, email: `${names.a}@example.com` });

      const taken = await agents.a.patch('/api/users/me').send({ username: names.b }).expect(409);
      expect(taken.body.code).toBe('USERNAME_TAKEN');
    });
  });

  describe('follow requests on a private account', () => {
    it('sends a request instead of following', async () => {
      await agents.b.patch('/api/users/me').send({ isPrivate: true }).expect(200);
      const res = await agents.a.post(`/api/users/${names.b}/follow`).expect(200);
      expect(res.body).toEqual({ followStatus: 'PENDING' });
      // idempotent
      await agents.a.post(`/api/users/${names.b}/follow`).expect(200);

      const profile = await agents.a.get(`/api/users/${names.b}`).expect(200);
      expect(profile.body).toMatchObject({ followStatus: 'PENDING', canViewContent: false });
      expect(await counters('b')).toMatchObject({ followersCount: 0 });

      const list = await agents.a.get(`/api/users/${names.b}/followers`).expect(403);
      expect(list.body.code).toBe('PRIVATE_ACCOUNT');
    });

    it('lists and accepts the request with counters', async () => {
      const requests = await agents.b.get('/api/follow-requests').expect(200);
      expect(requests.body.items.map((u: { id: string }) => u.id)).toEqual([ids.a]);
      const me = await agents.b.get('/api/users/me').expect(200);
      expect(me.body.pendingFollowRequestsCount).toBe(1);

      await agents.b.post(`/api/follow-requests/${ids.a}/accept`).expect(204);
      const again = await agents.b.post(`/api/follow-requests/${ids.a}/accept`).expect(404);
      expect(again.body.code).toBe('FOLLOW_REQUEST_NOT_FOUND');

      expect(await counters('b')).toMatchObject({ followersCount: 1 });
      expect(await counters('a')).toMatchObject({ followingCount: 1 });
      const list = await agents.a.get(`/api/users/${names.b}/followers`).expect(200);
      expect(list.body.items).toEqual([
        expect.objectContaining({ id: ids.a, isMe: true, followStatus: 'NONE' }),
      ]);
    });

    it('declines a request', async () => {
      await agents.c.post(`/api/users/${names.b}/follow`).expect(200);
      await agents.b.delete(`/api/follow-requests/${ids.c}`).expect(204);
      const profile = await agents.c.get(`/api/users/${names.b}`).expect(200);
      expect(profile.body.followStatus).toBe('NONE');
    });

    it('auto-accepts pending requests when the account becomes public', async () => {
      await agents.c.post(`/api/users/${names.b}/follow`).expect(200);
      const settings = await agents.b.patch('/api/settings').send({ isPrivate: false }).expect(200);
      expect(settings.body.isPrivate).toBe(false);
      expect(await counters('b')).toMatchObject({ followersCount: 2 });
      expect(await counters('c')).toMatchObject({ followingCount: 1 });
      const profile = await agents.c.get(`/api/users/${names.b}`).expect(200);
      expect(profile.body.followStatus).toBe('ACCEPTED');
    });
  });

  describe('followers lists', () => {
    it('filters by q and paginates by cursor', async () => {
      const filtered = await agents.a
        .get(`/api/users/${names.b}/followers`)
        .query({ q: names.c.toUpperCase() })
        .expect(200);
      expect(filtered.body.items.map((u: { id: string }) => u.id)).toEqual([ids.c]);

      const page1 = await agents.a
        .get(`/api/users/${names.b}/followers`)
        .query({ limit: 1 })
        .expect(200);
      expect(page1.body.items).toHaveLength(1);
      expect(page1.body.nextCursor).toBe(page1.body.items[0].id);
      const page2 = await agents.a
        .get(`/api/users/${names.b}/followers`)
        .query({ limit: 1, cursor: page1.body.nextCursor })
        .expect(200);
      expect(page2.body.items).toHaveLength(1);
      expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);
      expect(page2.body.nextCursor).toBeNull();

      const following = await agents.b.get(`/api/users/${names.a}/following`).expect(200);
      expect(following.body.items).toEqual([
        expect.objectContaining({ id: ids.b, isMe: true }),
      ]);
    });

    it('removes a follower and unfollows with counters', async () => {
      await agents.b.delete(`/api/users/${names.c}/follower`).expect(204);
      expect(await counters('b')).toMatchObject({ followersCount: 1 });
      expect(await counters('c')).toMatchObject({ followingCount: 0 });

      await agents.a.delete(`/api/users/${names.b}/follow`).expect(204);
      await agents.a.delete(`/api/users/${names.b}/follow`).expect(204);
      expect(await counters('b')).toMatchObject({ followersCount: 0 });
      expect(await counters('a')).toMatchObject({ followingCount: 0 });
    });

    it('rejects following yourself', async () => {
      const res = await agents.a.post(`/api/users/${names.a}/follow`).expect(400);
      expect(res.body.code).toBe('CANNOT_FOLLOW_SELF');
    });
  });

  describe('suggestions', () => {
    it('suggests people followed by people I follow', async () => {
      await agents.a.post(`/api/users/${names.b}/follow`).expect(200);
      await agents.b.post(`/api/users/${names.c}/follow`).expect(200);
      const res = await agents.a.get('/api/users/suggestions').query({ limit: 5 }).expect(200);
      const suggested = res.body.map((u: { id: string }) => u.id);
      expect(suggested[0]).toBe(ids.c);
      // "Followed by b": the reason under the name
      expect(res.body[0].followedBy).toEqual({ username: names.b, others: 0 });
      expect(suggested).not.toContain(ids.a);
      expect(suggested).not.toContain(ids.b);
    });
  });

  describe('blocking', () => {
    it('removes follows both ways and hides the blocker', async () => {
      await agents.c.post(`/api/users/${names.b}/follow`).expect(200);
      // b ↔ c follow each other now
      await agents.b.post(`/api/users/${names.c}/block`).expect(204);
      await agents.b.post(`/api/users/${names.c}/block`).expect(204);

      expect(await counters('b')).toMatchObject({ followersCount: 1, followingCount: 0 });
      expect(await counters('c')).toMatchObject({ followersCount: 0, followingCount: 0 });

      const hidden = await agents.c.get(`/api/users/${names.b}`).expect(404);
      expect(hidden.body.code).toBe('USER_NOT_FOUND');
      const followBlocked = await agents.c.post(`/api/users/${names.b}/follow`).expect(404);
      expect(followBlocked.body.code).toBe('USER_NOT_FOUND');

      const blockerView = await agents.b.get(`/api/users/${names.c}`).expect(200);
      expect(blockerView.body).toMatchObject({ isBlocked: true, canViewContent: false });

      const search = await agents.c.get('/api/search/users').query({ q: `e2u_${suffix}` }).expect(200);
      expect(search.body.map((u: { id: string }) => u.id)).not.toContain(ids.b);

      const blocked = await agents.b.get('/api/users/me/blocked').expect(200);
      expect(blocked.body.map((u: { id: string }) => u.id)).toEqual([ids.c]);

      const self = await agents.b.post(`/api/users/${names.b}/block`).expect(400);
      expect(self.body.code).toBe('CANNOT_BLOCK_SELF');
    });

    it('unblocks', async () => {
      await agents.b.delete(`/api/users/${names.c}/block`).expect(204);
      await agents.c.get(`/api/users/${names.b}`).expect(200);
      const blocked = await agents.b.get('/api/users/me/blocked').expect(200);
      expect(blocked.body).toEqual([]);
    });
  });

  describe('search', () => {
    it('finds users by username and full name, prefix matches first', async () => {
      const res = await agents.a
        .get('/api/search/users')
        .query({ q: `E2U_${suffix}` })
        .expect(200);
      expect(res.body.map((u: { id: string }) => u.id).sort()).toEqual(
        [ids.a, ids.b, ids.c].sort(),
      );

      const byName = await agents.a.get('/api/search/users').query({ q: `B ${suffix}` }).expect(200);
      expect(byName.body.map((u: { id: string }) => u.id)).toEqual([ids.b]);
    });

    it('finds hashtags by prefix', async () => {
      const res = await agents.a
        .get('/api/search/hashtags')
        .query({ q: `#${hashtag.slice(0, -1).toUpperCase()}` })
        .expect(200);
      expect(res.body).toEqual([{ name: hashtag, postsCount: 3 }]);
    });

    it('validates the query', async () => {
      const res = await agents.a.get('/api/search/users').expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('keeps recent searches, latest first', async () => {
      await agents.a.post('/api/search/history').send({ userId: ids.b }).expect(204);
      await agents.a.post('/api/search/history').send({ userId: ids.c }).expect(204);
      await agents.a.post('/api/search/history').send({ userId: ids.b }).expect(204);
      const history = await agents.a.get('/api/search/history').expect(200);
      expect(history.body.map((u: { id: string }) => u.id)).toEqual([ids.b, ids.c]);

      await agents.a.delete(`/api/search/history/${ids.b}`).expect(204);
      const after = await agents.a.get('/api/search/history').expect(200);
      expect(after.body.map((u: { id: string }) => u.id)).toEqual([ids.c]);

      await agents.a.delete('/api/search/history').expect(204);
      expect((await agents.a.get('/api/search/history').expect(200)).body).toEqual([]);

      const missing = await agents.a
        .post('/api/search/history')
        .send({ userId: 'missing' })
        .expect(404);
      expect(missing.body.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('settings', () => {
    it('reads and updates settings', async () => {
      const initial = await agents.a.get('/api/settings').expect(200);
      expect(initial.body).toMatchObject({
        isPrivate: false,
        theme: 'SYSTEM',
        language: 'EN',
        hasPassword: true,
        notifications: { pushEnabled: true, pausedUntil: null },
      });

      const updated = await agents.a
        .patch('/api/settings')
        .send({ theme: 'DARK', language: 'RU', messagePermission: 'FOLLOWING' })
        .expect(200);
      expect(updated.body).toMatchObject({
        theme: 'DARK',
        language: 'RU',
        messagePermission: 'FOLLOWING',
      });

      const paused = await agents.a
        .patch('/api/settings/notifications')
        .send({ likes: false, pauseHours: 8 })
        .expect(200);
      expect(paused.body.notifications.likes).toBe(false);
      const until = new Date(paused.body.notifications.pausedUntil).getTime();
      expect(until).toBeGreaterThan(Date.now() + 7 * 3_600_000);

      const resumed = await agents.a
        .patch('/api/settings/notifications')
        .send({ pauseHours: 0 })
        .expect(200);
      expect(resumed.body.notifications.pausedUntil).toBeNull();

      await agents.a.patch('/api/settings/notifications').send({ pauseHours: 5 }).expect(400);
    });

    it('lists sessions and logs out other devices', async () => {
      const other = request.agent(app.getHttpServer());
      await other
        .post('/api/auth/login')
        .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Version/17.0 Safari/605.1.15')
        .send({ login: names.a, password })
        .expect(200);

      const res = await agents.a.get('/api/settings/sessions').expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({ isCurrent: true, browser: 'Chrome', os: 'Windows' });
      expect(res.body[1]).toMatchObject({ isCurrent: false, browser: 'Safari', os: 'macOS' });

      const notMine = await agents.b.delete(`/api/settings/sessions/${res.body[1].id}`).expect(404);
      expect(notMine.body.code).toBe('NOT_FOUND');

      await agents.a.delete('/api/settings/sessions').expect(204);
      await other.post('/api/auth/refresh').expect(401);
      const after = await agents.a.get('/api/settings/sessions').expect(200);
      expect(after.body).toHaveLength(1);
    });

    it('changes the password', async () => {
      const wrong = await agents.c
        .patch('/api/users/me/password')
        .send({ currentPassword: 'wrong-password', newPassword: 'newpassword123' })
        .expect(400);
      expect(wrong.body.code).toBe('WRONG_PASSWORD');

      await agents.c
        .patch('/api/users/me/password')
        .send({ currentPassword: password, newPassword: 'newpassword123' })
        .expect(204);
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ login: names.c, password: 'newpassword123' })
        .expect(200);
      // current session survives
      await agents.c.get('/api/users/me').expect(200);
    });
  });
});
