import { createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AccessToken } from 'livekit-server-sdk';
import type { LiveJoin, LiveStream } from '@instagram/shared';
import { AppConfigService } from '../src/config/app-config.service';
import { LivesService } from '../src/modules/lives/lives.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { type TestUser, cleanupUsers, createTestApp, registerUser, wait } from './direct-helpers';

/** Live videos (LIVE-1…LIVE-7). LiveKit itself is not needed: the API issues tokens. */
describe('Lives (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let config: AppConfigService;
  let host: TestUser;
  let fan: TestUser;
  let stranger: TestUser;
  let liveId: string;
  let roomName: string;

  const sendWebhook = async (event: Record<string, unknown>) => {
    const body = JSON.stringify(event);
    const at = new AccessToken(config.get('LIVEKIT_API_KEY'), config.get('LIVEKIT_API_SECRET'));
    at.sha256 = createHash('sha256').update(body).digest('base64');
    return request(app.getHttpServer())
      .post('/api/calls/livekit-webhook')
      .set('Content-Type', 'application/webhook+json')
      .set('Authorization', await at.toJwt())
      .send(body)
      .expect(204);
  };

  const status = async (id: string) =>
    (await prisma.liveStream.findUniqueOrThrow({ where: { id } })).status;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    config = app.get(AppConfigService);
    host = await registerUser(app, 'live_host');
    fan = await registerUser(app, 'live_fan');
    stranger = await registerUser(app, 'live_str');
    await fan.agent.post(`/api/users/${host.username}/follow`).expect(200);
  });

  afterAll(async () => {
    await prisma.liveStream.deleteMany({ where: { hostId: { in: [host.id, fan.id] } } });
    await cleanupUsers(prisma, [host, fan, stranger]);
    await app.close();
  });

  it('goes live once: a second start rejoins the same live', async () => {
    const first = (await host.agent.post('/api/lives').expect(201)).body as LiveJoin;
    expect(first).toMatchObject({ isHost: true, live: { status: 'LIVE', host: { id: host.id } } });
    expect(first.token).toEqual(expect.any(String));
    liveId = first.live.id;
    roomName = (await prisma.liveStream.findUniqueOrThrow({ where: { id: liveId } })).roomName;

    const again = (await host.agent.post('/api/lives').expect(201)).body as LiveJoin;
    expect(again.live.id).toBe(liveId);
  });

  it('notifies followers and shows the live in their rings', async () => {
    await wait(300);
    const notification = await prisma.notification.findFirst({
      where: { recipientId: fan.id, actorId: host.id, type: 'LIVE_STARTED' },
    });
    expect(notification).not.toBeNull();

    const rings = (await fan.agent.get('/api/lives').expect(200)).body as LiveStream[];
    expect(rings.map((l) => l.id)).toContain(liveId);
    const strangerRings = (await stranger.agent.get('/api/lives').expect(200)).body as LiveStream[];
    expect(strangerRings.map((l) => l.id)).not.toContain(liveId);
  });

  it('opens by username and gives viewers a watch-only token', async () => {
    const live = (await fan.agent.get(`/api/users/${host.username}/live`).expect(200))
      .body as LiveStream;
    expect(live.id).toBe(liveId);
    const join = (await fan.agent.post(`/api/lives/${liveId}/join`).expect(200)).body as LiveJoin;
    expect(join.isHost).toBe(false);
    // the LiveKit grant inside the JWT: no publishing for viewers, data (chat) allowed
    const payload = JSON.parse(
      Buffer.from(join.token.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { video: { canPublish: boolean; canPublishData: boolean; room: string } };
    expect(payload.video).toMatchObject({
      canPublish: false,
      canPublishData: true,
      room: roomName,
    });
  });

  it('keeps a private live for approved followers only (LIVE-7)', async () => {
    await prisma.user.update({ where: { id: host.id }, data: { isPrivate: true } });
    const res = await stranger.agent.post(`/api/lives/${liveId}/join`).expect(403);
    expect(res.body.code).toBe('PRIVATE_ACCOUNT');
    await fan.agent.post(`/api/lives/${liveId}/join`).expect(200);
    await prisma.user.update({ where: { id: host.id }, data: { isPrivate: false } });
  });

  it('lets only the host end it', async () => {
    await fan.agent.post(`/api/lives/${liveId}/end`).expect(404);
    await host.agent.post(`/api/lives/${liveId}/end`).expect(204);
    expect(await status(liveId)).toBe('ENDED');

    const res = await fan.agent.post(`/api/lives/${liveId}/join`).expect(409);
    expect(res.body.code).toBe('LIVE_ENDED');
    const gone = await fan.agent.get(`/api/users/${host.username}/live`).expect(404);
    expect(gone.body.code).toBe('LIVE_NOT_FOUND');
  });

  it('ends by itself a minute after the host disconnects (LIVE-6)', async () => {
    const join = (await host.agent.post('/api/lives').expect(201)).body as LiveJoin;
    const id = join.live.id;
    const room = (await prisma.liveStream.findUniqueOrThrow({ where: { id } })).roomName;
    const lives = app.get(LivesService);

    await sendWebhook({
      event: 'participant_joined',
      room: { name: room },
      participant: { identity: host.id },
    });
    expect((await prisma.liveStream.findUniqueOrThrow({ where: { id } })).hostLeftAt).toBeNull();

    await sendWebhook({
      event: 'participant_left',
      room: { name: room },
      participant: { identity: host.id },
    });
    await lives.sweep();
    expect(await status(id)).toBe('LIVE'); // still within the grace minute

    await prisma.liveStream.update({
      where: { id },
      data: { hostLeftAt: new Date(Date.now() - 61_000) },
    });
    await lives.sweep();
    expect(await status(id)).toBe('ENDED');
  });
});
