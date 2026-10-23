import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Comment, Page, Post, UserListItem } from '@instagram/shared';
import { AppModule } from '../src/app.module';
import { PostsService } from '../src/modules/posts/posts.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Posts, feed, explore, hashtags, likes, saves, comments and media.
 * Requires a running database (pnpm db:up) with migrations applied.
 * Run: pnpm --filter api test:e2e
 */
describe('Posts, likes, comments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = Date.now().toString(36);
  const tag = `e2etag${suffix}`;
  const names = { alice: `pa_${suffix}`, bob: `pb_${suffix}`, carol: `pc_${suffix}` };
  type Name = keyof typeof names;
  const agents = {} as Record<Name, ReturnType<typeof request.agent>>;
  const ids = {} as Record<Name, string>;

  const image = (n: number) => ({
    type: 'IMAGE',
    url: `https://picsum.photos/seed/${suffix}${n}/1080/1080`,
    publicId: `instagram/posts/e2e_${suffix}_${n}`,
    width: 1080,
    height: 1080,
  });
  const video = {
    type: 'VIDEO',
    url: `https://example.com/${suffix}.mp4`,
    publicId: `instagram/reels/e2e_${suffix}`,
    width: 1080,
    height: 1920,
    duration: 12.5,
    thumbnailUrl: `https://example.com/${suffix}.jpg`,
  };

  let alicePost: Post;
  let aliceReel: Post;
  let bobPost: Post;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    for (const key of Object.keys(names) as Name[]) {
      agents[key] = request.agent(app.getHttpServer());
      const res = await agents[key]
        .post('/api/auth/register')
        .send({
          email: `${names[key]}@example.com`,
          fullName: `E2E ${key}`,
          username: names[key],
          password: 'password123',
        })
        .expect(201);
      ids[key] = (res.body as { id: string }).id;
    }
    await prisma.user.update({ where: { id: ids.bob }, data: { isPrivate: true } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { username: { in: Object.values(names) } } });
    await prisma.hashtag.deleteMany({ where: { name: { startsWith: tag } } });
    await prisma.location.deleteMany({ where: { osmId: { startsWith: `E2E${suffix}` } } });
    await app.close();
  });

  describe('media', () => {
    it('POST /media/signature validates the folder and needs Cloudinary keys', async () => {
      await agents.alice.post('/api/media/signature').send({ folder: 'nope' }).expect(400);
      const res = await agents.alice.post('/api/media/signature').send({ folder: 'posts' });
      // the dev .env has no Cloudinary keys; with keys this returns a signature
      expect([200, 503]).toContain(res.status);
      if (res.status === 503) expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
      else expect(res.body.folder).toBe('instagram/posts');
    });
  });

  describe('create / read / edit', () => {
    it('rejects media outside our Cloudinary folder', async () => {
      const res = await agents.alice
        .post('/api/posts')
        .send({ media: [{ ...image(0), publicId: 'someone/else' }] })
        .expect(400);
      expect(res.body.code).toBe('INVALID_MEDIA');
    });

    it('rejects a reel that is not a single video', async () => {
      const res = await agents.alice
        .post('/api/posts')
        .send({ type: 'REEL', media: [image(0)] })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('creates a carousel with hashtags and tagged users', async () => {
      const res = await agents.alice
        .post('/api/posts')
        .send({
          caption: `Sunset #${tag}A #${tag}a with @${names.carol}`,
          media: [image(1), image(2)],
          taggedUserIds: [ids.carol, 'missing-user-id'],
        })
        .expect(201);
      alicePost = res.body as Post;
      expect(alicePost).toMatchObject({
        type: 'POST',
        author: { id: ids.alice, username: names.alice },
        likesCount: 0,
        isLiked: false,
        isSaved: false,
      });
      expect(alicePost.media.map((m) => m.url)).toEqual([image(1).url, image(2).url]);
      expect(alicePost.taggedUsers.map((u) => u.id)).toEqual([ids.carol]);
      expect(JSON.stringify(alicePost)).not.toContain('publicId');

      const hashtag = await agents.carol.get(`/api/hashtags/%23${tag}A`).expect(200);
      expect(hashtag.body).toEqual({ name: `${tag}a`, postsCount: 1 });
    });

    it('creates a reel and counts posts on the profile', async () => {
      const res = await agents.alice
        .post('/api/posts')
        .send({ type: 'REEL', caption: `#${tag}reel`, media: [video] })
        .expect(201);
      aliceReel = res.body as Post;
      expect(aliceReel.media[0]).toMatchObject({ type: 'VIDEO', duration: 12.5 });
      const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.alice } });
      expect(user.postsCount).toBe(2);
    });

    it('splits profile grids into posts and reels; tagged shows tagged posts', async () => {
      const posts = await agents.bob.get(`/api/users/${names.alice}/posts`).expect(200);
      expect((posts.body as Page<Post>).items.map((p) => p.id)).toEqual([alicePost.id]);
      const reels = await agents.bob.get(`/api/users/${names.alice}/reels`).expect(200);
      expect((reels.body as Page<Post>).items.map((p) => p.id)).toEqual([aliceReel.id]);
      const tagged = await agents.bob.get(`/api/users/${names.carol}/tagged`).expect(200);
      expect((tagged.body as Page<Post>).items.map((p) => p.id)).toEqual([alicePost.id]);
      const mine = await agents.alice.get('/api/users/me/posts').expect(200);
      expect((mine.body as Page<Post>).items).toHaveLength(1);
      await agents.bob.get(`/api/users/nobody_${suffix}/posts`).expect(404);
    });

    it('edits the caption and keeps hashtag counters in sync', async () => {
      const res = await agents.alice
        .patch(`/api/posts/${alicePost.id}`)
        .send({ caption: `New #${tag}b`, commentsDisabled: false })
        .expect(200);
      expect(res.body.caption).toBe(`New #${tag}b`);
      expect((await agents.bob.get(`/api/hashtags/${tag}a`)).body.postsCount).toBe(0);
      expect((await agents.bob.get(`/api/hashtags/${tag}b`)).body.postsCount).toBe(1);
      const list = await agents.bob.get(`/api/hashtags/${tag}b/posts`).expect(200);
      expect((list.body as Page<Post>).items.map((p) => p.id)).toEqual([alicePost.id]);
    });

    it("forbids editing someone else's post", async () => {
      const res = await agents.bob
        .patch(`/api/posts/${alicePost.id}`)
        .send({ caption: 'hacked' })
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('visibility', () => {
    it('hides posts of a private account from non-followers', async () => {
      const res = await agents.bob
        .post('/api/posts')
        .send({ media: [image(3)] })
        .expect(201);
      bobPost = res.body as Post;
      const denied = await agents.carol.get(`/api/posts/${bobPost.id}`).expect(403);
      expect(denied.body.code).toBe('PRIVATE_ACCOUNT');
      await agents.carol.get(`/api/users/${names.bob}/posts`).expect(403);
      const map = await app.get(PostsService).getByIds(ids.carol, [bobPost.id, alicePost.id]);
      expect([...map.keys()]).toEqual([alicePost.id]);
    });

    it('feed = own posts + accepted followings, newest first, no reels', async () => {
      await prisma.follow.create({
        data: { followerId: ids.carol, followingId: ids.bob, status: 'ACCEPTED' },
      });
      await agents.carol.get(`/api/posts/${bobPost.id}`).expect(200);
      const feed = await agents.carol.get('/api/feed').expect(200);
      expect((feed.body as Page<Post>).items.map((p) => p.id)).toEqual([bobPost.id]);

      const aliceFeed = await agents.alice.get('/api/feed?limit=1').expect(200);
      expect((aliceFeed.body as Page<Post>).items.map((p) => p.id)).toEqual([alicePost.id]);
      expect(aliceFeed.body.nextCursor).toBeNull();
    });

    it('reels feed contains public reels', async () => {
      const ids_: string[] = [];
      let cursor: string | null = null;
      do {
        const res = await agents.carol
          .get(`/api/reels?limit=50${cursor ? `&cursor=${cursor}` : ''}`)
          .expect(200);
        const page = res.body as Page<Post>;
        ids_.push(...page.items.map((p) => p.id));
        expect(page.items.every((p) => p.type === 'REEL')).toBe(true);
        cursor = page.nextCursor;
      } while (cursor && !ids_.includes(aliceReel.id));
      expect(ids_).toContain(aliceReel.id);
    });

    it('explore shows public accounts I do not follow, without duplicates', async () => {
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const res = await agents.carol
          .get(`/api/explore?limit=50${cursor ? `&cursor=${cursor}` : ''}`)
          .expect(200);
        const page = res.body as Page<Post>;
        seen.push(...page.items.map((p) => p.id));
        for (const p of page.items) expect([ids.carol, ids.bob]).not.toContain(p.author.id);
        cursor = page.nextCursor;
      } while (cursor);
      expect(new Set(seen).size).toBe(seen.length);
      expect(seen).toEqual(expect.arrayContaining([alicePost.id, aliceReel.id]));
    });

    it('a block hides posts with 404', async () => {
      await prisma.block.create({ data: { blockerId: ids.alice, blockedId: ids.bob } });
      const res = await agents.bob.get(`/api/posts/${alicePost.id}`).expect(404);
      expect(res.body.code).toBe('POST_NOT_FOUND');
      await agents.bob.get(`/api/users/${names.alice}/posts`).expect(404);
      await prisma.block.deleteMany({ where: { blockerId: ids.alice } });
    });
  });

  describe('likes and saves', () => {
    it('like is idempotent and visible in isLiked and likers', async () => {
      await agents.carol.post(`/api/posts/${alicePost.id}/like`).expect(200, { likesCount: 1 });
      await agents.carol.post(`/api/posts/${alicePost.id}/like`).expect(200, { likesCount: 1 });
      await agents.bob.post(`/api/posts/${alicePost.id}/like`).expect(200, { likesCount: 2 });

      const post = await agents.carol.get(`/api/posts/${alicePost.id}`).expect(200);
      expect(post.body).toMatchObject({ isLiked: true, likesCount: 2 });
      // "Liked by bob and 1 other": the viewer herself is never in likedBy
      expect((post.body as Post).likedBy.map((u) => u.id)).toEqual([ids.bob]);
      const asAlice = await agents.alice.get(`/api/posts/${alicePost.id}`).expect(200);
      expect((asAlice.body as Post).likedBy.map((u) => u.id).sort()).toEqual(
        [ids.bob, ids.carol].sort(),
      );

      const likers = await agents.carol.get(`/api/posts/${alicePost.id}/likes?limit=1`).expect(200);
      const page1 = likers.body as Page<UserListItem>;
      expect(page1.items[0]).toMatchObject({ id: ids.bob, followStatus: 'ACCEPTED', isMe: false });
      const next = await agents.carol
        .get(`/api/posts/${alicePost.id}/likes?limit=1&cursor=${page1.nextCursor}`)
        .expect(200);
      expect(next.body.items[0]).toMatchObject({ id: ids.carol, isMe: true });
      expect(next.body.nextCursor).toBeNull();

      const filtered = await agents.carol
        .get(`/api/posts/${alicePost.id}/likes?q=${names.bob}`)
        .expect(200);
      expect(filtered.body.items.map((u: UserListItem) => u.id)).toEqual([ids.bob]);

      await agents.carol.delete(`/api/posts/${alicePost.id}/like`).expect(200, { likesCount: 1 });
      await agents.carol.delete(`/api/posts/${alicePost.id}/like`).expect(200, { likesCount: 1 });
    });

    it('saves posts into /users/me/saved', async () => {
      await agents.carol.post(`/api/posts/${alicePost.id}/save`).expect(204);
      await agents.carol.post(`/api/posts/${alicePost.id}/save`).expect(204);
      await agents.carol.post(`/api/posts/${aliceReel.id}/save`).expect(204);
      const saved = await agents.carol.get('/api/users/me/saved?limit=1').expect(200);
      expect(saved.body.items[0]).toMatchObject({ id: aliceReel.id, isSaved: true });
      const rest = await agents.carol
        .get(`/api/users/me/saved?limit=1&cursor=${saved.body.nextCursor}`)
        .expect(200);
      expect(rest.body.items.map((p: Post) => p.id)).toEqual([alicePost.id]);
      await agents.carol.delete(`/api/posts/${aliceReel.id}/save`).expect(204);
      const after = await agents.carol.get('/api/users/me/saved').expect(200);
      expect(after.body.items.map((p: Post) => p.id)).toEqual([alicePost.id]);
    });

    it('counts reel views from other users only', async () => {
      await agents.carol.post(`/api/posts/${aliceReel.id}/view`).expect(204);
      await agents.alice.post(`/api/posts/${aliceReel.id}/view`).expect(204);
      const reel = await agents.carol.get(`/api/posts/${aliceReel.id}`).expect(200);
      expect(reel.body.viewsCount).toBe(1);
    });
  });

  describe('comments', () => {
    let top: Comment;
    let reply: Comment;

    it('creates comments and flattens replies to one level', async () => {
      top = (
        await agents.carol
          .post(`/api/posts/${alicePost.id}/comments`)
          .send({ text: 'Nice!' })
          .expect(201)
      ).body as Comment;
      reply = (
        await agents.bob
          .post(`/api/posts/${alicePost.id}/comments`)
          .send({ text: 'Agree', parentId: top.id })
          .expect(201)
      ).body as Comment;
      const nested = (
        await agents.alice
          .post(`/api/posts/${alicePost.id}/comments`)
          .send({ text: 'Thanks', parentId: reply.id })
          .expect(201)
      ).body as Comment;
      expect(reply.parentId).toBe(top.id);
      expect(nested.parentId).toBe(top.id);

      const list = await agents.bob.get(`/api/posts/${alicePost.id}/comments`).expect(200);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0]).toMatchObject({ id: top.id, repliesCount: 2 });

      const replies = await agents.bob.get(`/api/comments/${top.id}/replies`).expect(200);
      expect(replies.body.items.map((c: Comment) => c.id)).toEqual([reply.id, nested.id]);

      const post = await agents.bob.get(`/api/posts/${alicePost.id}`).expect(200);
      expect(post.body.commentsCount).toBe(3);
    });

    it('rejects a parent from another post', async () => {
      const res = await agents.carol
        .post(`/api/posts/${aliceReel.id}/comments`)
        .send({ text: 'x', parentId: top.id })
        .expect(404);
      expect(res.body.code).toBe('COMMENT_NOT_FOUND');
    });

    it('likes comments idempotently', async () => {
      await agents.alice.post(`/api/comments/${top.id}/like`).expect(200, { likesCount: 1 });
      await agents.alice.post(`/api/comments/${top.id}/like`).expect(200, { likesCount: 1 });
      const list = await agents.alice.get(`/api/posts/${alicePost.id}/comments`).expect(200);
      expect(list.body.items[0]).toMatchObject({ isLiked: true, likesCount: 1 });
      await agents.alice.delete(`/api/comments/${top.id}/like`).expect(200, { likesCount: 0 });
    });

    it('respects disabled comments', async () => {
      await agents.alice
        .patch(`/api/posts/${alicePost.id}`)
        .send({ commentsDisabled: true })
        .expect(200);
      const res = await agents.carol
        .post(`/api/posts/${alicePost.id}/comments`)
        .send({ text: 'hi' })
        .expect(403);
      expect(res.body.code).toBe('COMMENTS_DISABLED');
      await agents.alice
        .patch(`/api/posts/${alicePost.id}`)
        .send({ commentsDisabled: false })
        .expect(200);
    });

    it('only the comment author or the post author can delete', async () => {
      await agents.carol.delete(`/api/comments/${reply.id}`).expect(403);
      await agents.bob.delete(`/api/comments/${reply.id}`).expect(204);
      let post = await agents.bob.get(`/api/posts/${alicePost.id}`).expect(200);
      expect(post.body.commentsCount).toBe(2);
      const list = await agents.bob.get(`/api/posts/${alicePost.id}/comments`).expect(200);
      expect(list.body.items[0].repliesCount).toBe(1);

      // post author deletes the top-level comment together with its replies
      await agents.alice.delete(`/api/comments/${top.id}`).expect(204);
      post = await agents.bob.get(`/api/posts/${alicePost.id}`).expect(200);
      expect(post.body.commentsCount).toBe(0);
      await agents.alice.delete(`/api/comments/${top.id}`).expect(404);
    });
  });

  describe('delete', () => {
    it('deletes a post with its hashtags and counters', async () => {
      await agents.bob.delete(`/api/posts/${alicePost.id}`).expect(403);
      await agents.alice.delete(`/api/posts/${alicePost.id}`).expect(204);
      const res = await agents.alice.get(`/api/posts/${alicePost.id}`).expect(404);
      expect(res.body.code).toBe('POST_NOT_FOUND');
      expect((await agents.alice.get(`/api/hashtags/${tag}b`)).body.postsCount).toBe(0);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: ids.alice } });
      expect(user.postsCount).toBe(1);
      await agents.carol.delete(`/api/posts/${alicePost.id}/like`).expect(404);
    });
  });

  describe('locations', () => {
    const place = {
      osmId: `E2E${suffix}`,
      name: 'Galata Tower',
      address: 'Istanbul, Türkiye',
      lat: 41.0256,
      lng: 28.9742,
    };
    let locationId: string;

    it('saves a place with the post, one row per place', async () => {
      const first = await agents.carol
        .post('/api/posts')
        .send({ media: [image(31)], location: place })
        .expect(201);
      expect(first.body.location).toMatchObject({ name: 'Galata Tower' });
      locationId = first.body.location.id as string;

      const second = await agents.alice
        .post('/api/posts')
        .send({ media: [image(32)], location: { ...place, name: 'Galata Kulesi' } })
        .expect(201);
      expect(second.body.location.id).toBe(locationId);
    });

    it("shows the place's page: header and the posts the viewer may see", async () => {
      const header = await agents.carol.get(`/api/locations/${locationId}`).expect(200);
      expect(header.body).toMatchObject({
        id: locationId,
        name: 'Galata Kulesi', // the latest post's name for the place wins
        address: 'Istanbul, Türkiye',
        postsCount: 2,
      });
      const posts = await agents.carol.get(`/api/locations/${locationId}/posts`).expect(200);
      expect((posts.body as Page<Post>).items).toHaveLength(2);
      await agents.carol.get('/api/locations/missing').expect(404);
    });

    it('changes or removes the place when editing', async () => {
      const post = await agents.carol
        .post('/api/posts')
        .send({ media: [image(34)], location: place })
        .expect(201);
      const removed = await agents.carol
        .patch(`/api/posts/${post.body.id}`)
        .send({ location: null })
        .expect(200);
      expect(removed.body.location).toBeNull();
    });

    it('needs 2 to 100 characters to search', async () => {
      await agents.carol.get('/api/locations/search?q=a').expect(400);
    });
  });
});
