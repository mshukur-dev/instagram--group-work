import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type {
  AdminAction,
  AdminComment,
  AdminPost,
  AdminStats,
  AdminUser,
  Me,
  Page,
  Post,
} from '@instagram/shared';
import { AppConfigService } from '../src/config/app-config.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { type TestUser, cleanupUsers, createTestApp, registerUser } from './direct-helpers';

/** Admin panel (ADMIN-1…ADMIN-6). */
describe('Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let bobPost: Post;
  let carolPost: Post;
  let commentId: string;
  let cloud: string | undefined;

  // With real Cloudinary keys in .env the API only accepts URLs from that cloud
  const image = (n: number) => ({
    type: 'IMAGE',
    url: cloud
      ? `https://res.cloudinary.com/${cloud}/image/upload/e2e_admin_${n}.jpg`
      : `https://picsum.photos/seed/admin_${n}/1080/1080`,
    publicId: `instagram/posts/e2e_admin_${Date.now()}_${n}`,
    width: 1080,
    height: 1080,
  });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    cloud = app.get(AppConfigService).get('CLOUDINARY_CLOUD_NAME') || undefined;
    admin = await registerUser(app, 'adm');
    bob = await registerUser(app, 'adm_bob');
    carol = await registerUser(app, 'adm_carol');
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });

    bobPost = (await bob.agent.post('/api/posts').send({ media: [image(1)] }).expect(201))
      .body as Post;
    carolPost = (await carol.agent.post('/api/posts').send({ media: [image(2)] }).expect(201))
      .body as Post;
    commentId = (
      await carol.agent
        .post(`/api/posts/${bobPost.id}/comments`)
        .send({ text: 'rude comment' })
        .expect(201)
    ).body.id as string;
  });

  afterAll(async () => {
    await prisma.adminAction.deleteMany({ where: { adminId: admin.id } });
    await cleanupUsers(prisma, [admin, bob, carol]);
    await app.close();
  });

  it('ADMIN-1: hides /admin from regular users with 404 and shows the role in /users/me', async () => {
    const res = await bob.agent.get('/api/admin/stats').expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(((await bob.agent.get('/api/users/me').expect(200)).body as Me).role).toBe('USER');
    expect(((await admin.agent.get('/api/users/me').expect(200)).body as Me).role).toBe('ADMIN');
  });

  it('ADMIN-2: counts everything, today and for 7 days', async () => {
    const stats = (await admin.agent.get('/api/admin/stats').expect(200)).body as AdminStats;
    expect(stats.total.users).toBeGreaterThanOrEqual(3);
    expect(stats.today.users).toBeGreaterThanOrEqual(3);
    expect(stats.last7Days.posts).toBeGreaterThanOrEqual(2);
    expect(stats.total.posts).toBeGreaterThanOrEqual(stats.today.posts);
    expect(stats).toHaveProperty('online');
  });

  it('ADMIN-3: searches by username, name and email, newest first', async () => {
    const byName = (await admin.agent.get('/api/admin/users').query({ q: bob.username }).expect(200))
      .body as Page<AdminUser>;
    expect(byName.items.map((u) => u.id)).toEqual([bob.id]);
    expect(byName.items[0]?.email).toBe(`${bob.username}@example.com`);

    const byEmail = (
      await admin.agent
        .get('/api/admin/users')
        .query({ q: `${carol.username.toUpperCase()}@EXAMPLE` })
        .expect(200)
    ).body as Page<AdminUser>;
    expect(byEmail.items.map((u) => u.id)).toEqual([carol.id]);

    const newest = (await admin.agent.get('/api/admin/users').query({ q: 'adm' }).expect(200))
      .body as Page<AdminUser>;
    const ours = newest.items.filter((u) => [admin.id, bob.id, carol.id].includes(u.id));
    expect(ours.map((u) => u.id)).toEqual([carol.id, bob.id, admin.id]);
  });

  it('ADMIN-4: an admin cannot be banned', async () => {
    const res = await admin.agent
      .post(`/api/admin/users/${admin.id}/ban`)
      .send({ reason: 'test' })
      .expect(403);
    expect(res.body.code).toBe('CANNOT_BAN_ADMIN');
  });

  it('ADMIN-4: a ban ends sessions, blocks login and hides the profile and posts', async () => {
    const banned = (
      await admin.agent
        .post(`/api/admin/users/${bob.id}/ban`)
        .send({ reason: 'Spam' })
        .expect(200)
    ).body as AdminUser;
    expect(banned).toMatchObject({ banReason: 'Spam', bannedAt: expect.any(String) });

    // the old access token stops working at once
    await bob.agent.get('/api/users/me').expect(401);
    expect(await prisma.session.count({ where: { userId: bob.id } })).toBe(0);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: bob.username, password: 'password123' })
      .expect(403);
    expect(login.body).toMatchObject({ code: 'ACCOUNT_BANNED', details: { reason: 'Spam' } });

    await carol.agent.get(`/api/users/${bob.username}`).expect(404);
    await carol.agent.get(`/api/posts/${bobPost.id}`).expect(404);

    const onlyBanned = (
      await admin.agent.get('/api/admin/users').query({ q: 'adm_', banned: 'true' }).expect(200)
    ).body as Page<AdminUser>;
    expect(onlyBanned.items.map((u) => u.id)).toEqual([bob.id]);
  });

  it('ADMIN-4: unban lets the user back in', async () => {
    const user = (await admin.agent.delete(`/api/admin/users/${bob.id}/ban`).expect(200))
      .body as AdminUser;
    expect(user).toMatchObject({ bannedAt: null, banReason: null });
    await bob.agent
      .post('/api/auth/login')
      .send({ login: bob.username, password: 'password123' })
      .expect(200);
    await carol.agent.get(`/api/users/${bob.username}`).expect(200);
  });

  it('ADMIN-5: lists recent posts and comments and deletes any of them', async () => {
    const posts = (await admin.agent.get('/api/admin/posts').query({ type: 'POST' }).expect(200))
      .body as Page<AdminPost>;
    expect(posts.items.map((p) => p.id)).toEqual(expect.arrayContaining([bobPost.id, carolPost.id]));
    expect(posts.items.find((p) => p.id === carolPost.id)).toMatchObject({
      author: { id: carol.id },
      mediaCount: 1,
      previewUrl: expect.stringContaining('admin_2'),
    });

    const comments = (await admin.agent.get('/api/admin/comments').expect(200))
      .body as Page<AdminComment>;
    expect(comments.items.find((c) => c.id === commentId)).toMatchObject({
      text: 'rude comment',
      postId: bobPost.id,
      isReply: false,
    });

    await admin.agent.delete(`/api/admin/comments/${commentId}`).expect(204);
    const post = await prisma.post.findUniqueOrThrow({ where: { id: bobPost.id } });
    expect(post.commentsCount).toBe(0);

    await admin.agent.delete(`/api/admin/posts/${carolPost.id}`).expect(204);
    await admin.agent.delete(`/api/admin/posts/${carolPost.id}`).expect(404);
    const author = await prisma.user.findUniqueOrThrow({ where: { id: carol.id } });
    expect(author.postsCount).toBe(0);
  });

  it('ADMIN-6: logs every action, newest first', async () => {
    const log = (await admin.agent.get('/api/admin/actions').expect(200)).body as Page<AdminAction>;
    const mine = log.items.filter((a) => a.admin.id === admin.id).map((a) => a.type);
    expect(mine).toEqual(['DELETE_POST', 'DELETE_COMMENT', 'UNBAN_USER', 'BAN_USER']);
  });
});
