import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Highlight, Page, Story, StoryTray, StoryViewer } from '@instagram/shared';
import { AppModule } from '../src/app.module';
import { StoriesService } from '../src/modules/stories/stories.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Stories, views, likes, archive and highlights.
 * Requires a running database (pnpm db:up) with migrations applied.
 */
describe('Stories (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = Date.now().toString(36);
  const names = { author: `st_a_${suffix}`, fan: `st_f_${suffix}`, stranger: `st_s_${suffix}` };
  const agents: Record<keyof typeof names, request.Agent> = {} as never;
  const ids: Record<keyof typeof names, string> = {} as never;

  const media = (n: number) => ({
    type: 'IMAGE',
    url: `https://res.cloudinary.com/demo/image/upload/story_${n}.jpg`,
    publicId: `instagram/stories/story_${n}`,
    width: 1080,
    height: 1920,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

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
    // The author is private; fan follows them, stranger doesn't
    await prisma.user.update({ where: { id: ids.author }, data: { isPrivate: true } });
    await prisma.follow.create({
      data: { followerId: ids.fan, followingId: ids.author, status: 'ACCEPTED' },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { username: { in: Object.values(names) } } });
    await app.close();
  });

  let storyId = '';
  let expiredId = '';

  it('creates a story that expires in 24 hours', async () => {
    const res = await agents.author.post('/api/stories').send(media(1)).expect(201);
    const story = res.body as Story;
    storyId = story.id;
    const ttl = new Date(story.expiresAt).getTime() - new Date(story.createdAt).getTime();
    expect(ttl).toBe(24 * 60 * 60 * 1000);
    expect(story).toMatchObject({ mediaType: 'IMAGE', isSeen: false, viewsCount: 0 });
    expect(story.author.username).toBe(names.author);

    const expired = await prisma.story.create({
      data: {
        authorId: ids.author,
        mediaType: 'IMAGE',
        url: media(2).url,
        publicId: media(2).publicId,
        createdAt: new Date(Date.now() - 48 * 3600_000),
        expiresAt: new Date(Date.now() - 24 * 3600_000),
      },
    });
    expiredId = expired.id;
  });

  it('rejects invalid media', async () => {
    const res = await agents.author.post('/api/stories').send({ type: 'IMAGE' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('shows active stories only to allowed viewers', async () => {
    const res = await agents.fan.get(`/api/users/${names.author}/stories`).expect(200);
    const stories = res.body as Story[];
    expect(stories.map((s) => s.id)).toEqual([storyId]);
    expect(stories[0]?.viewsCount).toBeUndefined();

    const denied = await agents.stranger.get(`/api/users/${names.author}/stories`).expect(403);
    expect(denied.body.code).toBe('PRIVATE_ACCOUNT');
    await agents.stranger.post(`/api/stories/${storyId}/view`).expect(404);
    await agents.fan.get('/api/users/nobody_here_xyz/stories').expect(404);
  });

  it('puts unseen users in the tray and moves them after viewing', async () => {
    let tray = (await agents.fan.get('/api/stories/feed').expect(200)).body as StoryTray[];
    expect(tray.find((t) => t.user.id === ids.author)).toMatchObject({ hasUnseen: true });

    await agents.fan.post(`/api/stories/${storyId}/view`).expect(204);
    await agents.fan.post(`/api/stories/${storyId}/view`).expect(204); // idempotent

    tray = (await agents.fan.get('/api/stories/feed').expect(200)).body as StoryTray[];
    expect(tray.find((t) => t.user.id === ids.author)).toMatchObject({ hasUnseen: false });

    const authorTray = (await agents.author.get('/api/stories/feed').expect(200))
      .body as StoryTray[];
    expect(authorTray[0]?.user.id).toBe(ids.author);

    const strangerTray = (await agents.stranger.get('/api/stories/feed').expect(200))
      .body as StoryTray[];
    expect(strangerTray.some((t) => t.user.id === ids.author)).toBe(false);
  });

  it('counts a view once per viewer and never for the author', async () => {
    await agents.author.post(`/api/stories/${storyId}/view`).expect(204);
    const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId } });
    expect(story.viewsCount).toBe(1);
  });

  it('likes a story, notifies the author and lists viewers for the author only', async () => {
    await agents.fan.post(`/api/stories/${storyId}/like`).expect(204);
    await agents.fan.post(`/api/stories/${storyId}/like`).expect(204);
    await agents.author.post(`/api/stories/${storyId}/like`).expect(403);

    // create() runs after the response; give it a moment
    await new Promise((resolve) => setTimeout(resolve, 300));
    const notifications = await prisma.notification.findMany({
      where: { recipientId: ids.author, type: 'STORY_LIKE', storyId },
    });
    expect(notifications).toHaveLength(1);

    const viewers = (await agents.author.get(`/api/stories/${storyId}/viewers`).expect(200))
      .body as Page<StoryViewer>;
    expect(viewers.items).toEqual([
      expect.objectContaining({ id: ids.fan, liked: true, viewedAt: expect.any(String) }),
    ]);
    expect(viewers.nextCursor).toBeNull();
    await agents.fan.get(`/api/stories/${storyId}/viewers`).expect(403);

    const mine = (await agents.fan.get(`/api/users/${names.author}/stories`).expect(200))
      .body as Story[];
    expect(mine[0]).toMatchObject({ isSeen: true, isLiked: true });

    await agents.fan.delete(`/api/stories/${storyId}/like`).expect(204);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await prisma.notification.count({ where: { recipientId: ids.author, storyId } })).toBe(
      0,
    );
  });

  it('archive lists all my stories including expired ones', async () => {
    const page = (await agents.author.get('/api/stories/archive?limit=1').expect(200))
      .body as Page<Story>;
    expect(page.items.map((s) => s.id)).toEqual([storyId]);
    expect(page.nextCursor).toBe(storyId);
    const next = (
      await agents.author.get(`/api/stories/archive?limit=1&cursor=${page.nextCursor}`).expect(200)
    ).body as Page<Story>;
    expect(next.items.map((s) => s.id)).toEqual([expiredId]);
    expect(next.nextCursor).toBeNull();
  });

  it('manages highlights with own stories only', async () => {
    const strangerStory = (await agents.stranger.post('/api/stories').send(media(3)).expect(201))
      .body as Story;

    const foreign = await agents.author
      .post('/api/highlights')
      .send({ title: 'Trip', storyIds: [strangerStory.id] })
      .expect(404);
    expect(foreign.body.code).toBe('STORY_NOT_FOUND');

    const created = (
      await agents.author
        .post('/api/highlights')
        .send({ title: 'Trip', storyIds: [expiredId] })
        .expect(201)
    ).body as Highlight;
    expect(created).toMatchObject({ title: 'Trip', storiesCount: 1, coverUrl: media(2).url });

    const updated = (
      await agents.author
        .patch(`/api/highlights/${created.id}`)
        .send({ title: 'Summer', addStoryIds: [storyId], coverUrl: media(9).url })
        .expect(200)
    ).body as Highlight;
    expect(updated).toMatchObject({ title: 'Summer', storiesCount: 2, coverUrl: media(9).url });

    await agents.stranger.patch(`/api/highlights/${created.id}`).send({ title: 'x' }).expect(403);
    await agents.stranger.get(`/api/highlights/${created.id}/stories`).expect(404);

    const list = (await agents.fan.get(`/api/users/${names.author}/highlights`).expect(200))
      .body as Highlight[];
    expect(list.map((h) => h.id)).toEqual([created.id]);

    const stories = (await agents.fan.get(`/api/highlights/${created.id}/stories`).expect(200))
      .body as Story[];
    expect(stories.map((s) => s.id)).toEqual([expiredId, storyId]);

    const removed = (
      await agents.author
        .patch(`/api/highlights/${created.id}`)
        .send({ removeStoryIds: [storyId] })
        .expect(200)
    ).body as Highlight;
    expect(removed.storiesCount).toBe(1);

    await agents.stranger.delete(`/api/highlights/${created.id}`).expect(403);
    await agents.author.delete(`/api/highlights/${created.id}`).expect(204);
    await agents.author.delete(`/api/highlights/${created.id}`).expect(404);
  });

  it('getByIds omits stories the viewer cannot access', async () => {
    const service = app.get(StoriesService);
    const forFan = await service.getByIds(ids.fan, [storyId, expiredId]);
    expect([...forFan.keys()].sort()).toEqual([storyId, expiredId].sort());
    const forStranger = await service.getByIds(ids.stranger, [storyId]);
    expect(forStranger.size).toBe(0);
  });

  it('deletes only own stories', async () => {
    await agents.fan.delete(`/api/stories/${storyId}`).expect(403);
    await agents.author.delete(`/api/stories/${storyId}`).expect(204);
    const res = await agents.author.delete(`/api/stories/${storyId}`).expect(404);
    expect(res.body.code).toBe('STORY_NOT_FOUND');
  });
});
