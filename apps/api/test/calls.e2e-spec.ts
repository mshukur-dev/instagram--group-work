import { createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AccessToken } from 'livekit-server-sdk';
import type { CallJoin, Message, Page } from '@instagram/shared';
import { AppConfigService } from '../src/config/app-config.service';
import { CallsService } from '../src/modules/calls/calls.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { type TestUser, cleanupUsers, createTestApp, registerUser, wait } from './direct-helpers';

/**
 * Calls over LiveKit (CALL-1…CALL-5, CALL-9). LiveKit itself is not needed:
 * the API only issues tokens and tracks state.
 */
describe('Calls (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let config: AppConfigService;
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let directId: string;
  let carolBobId: string;
  let groupId: string;

  const start = (user: TestUser, conversationId: string, type = 'VIDEO') =>
    user.agent.post(`/api/conversations/${conversationId}/calls`).send({ type });

  const callStatus = async (callId: string) =>
    (await prisma.call.findUniqueOrThrow({ where: { id: callId } })).status;

  const lastMessage = async (
    user: TestUser,
    conversationId: string,
  ): Promise<Message | undefined> => {
    const res = await user.agent
      .get(`/api/conversations/${conversationId}/messages?limit=1`)
      .expect(200);
    return (res.body as Page<Message>).items[0];
  };

  /** A webhook signed like LiveKit does: JWT with the sha256 of the body. */
  const sendWebhook = async (event: Record<string, unknown>, status: number, sign = true) => {
    const body = JSON.stringify(event);
    const at = new AccessToken(config.get('LIVEKIT_API_KEY'), config.get('LIVEKIT_API_SECRET'));
    at.sha256 = createHash('sha256').update(body).digest('base64');
    const token = sign ? await at.toJwt() : 'invalid';
    return request(app.getHttpServer())
      .post('/api/calls/livekit-webhook')
      .set('Content-Type', 'application/webhook+json')
      .set('Authorization', token)
      .send(body)
      .expect(status);
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    config = app.get(AppConfigService);
    alice = await registerUser(app, 'call_alice');
    bob = await registerUser(app, 'call_bob');
    carol = await registerUser(app, 'call_carol');
    directId = (await alice.agent.post(`/api/conversations/direct/${bob.id}`).expect(200)).body.id;
    carolBobId = (await carol.agent.post(`/api/conversations/direct/${bob.id}`).expect(200)).body
      .id;
    groupId = (
      await alice.agent
        .post('/api/conversations/group')
        .send({ title: 'Call group', memberIds: [bob.id, carol.id] })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await cleanupUsers(prisma, [alice, bob, carol]);
    await app.close();
  });

  it('starts a 1:1 call with a LiveKit token, accepts and ends it', async () => {
    const res = await start(alice, directId).expect(201);
    const join = res.body as CallJoin;
    expect(join.call).toMatchObject({
      conversationId: directId,
      type: 'VIDEO',
      status: 'RINGING',
      startedById: alice.id,
      roomName: `call_${join.call.id}`,
    });
    expect(join.token.split('.')).toHaveLength(3);
    expect(join.url).toBe(config.get('LIVEKIT_URL'));

    const busy = await start(bob, directId).expect(409);
    expect(busy.body).toMatchObject({
      code: 'CALL_ALREADY_ACTIVE',
      details: { callId: join.call.id },
    });

    const preview = await bob.agent.get(`/api/conversations/${directId}`).expect(200);
    expect(preview.body.activeCall).toMatchObject({ id: join.call.id, status: 'RINGING' });

    const accepted = await bob.agent.post(`/api/calls/${join.call.id}/join`).expect(200);
    expect(accepted.body.call).toMatchObject({ status: 'ACTIVE', answeredAt: expect.any(String) });

    await alice.agent.post(`/api/calls/${join.call.id}/leave`).expect(204);
    expect(await callStatus(join.call.id)).toBe('ENDED');

    const record = await lastMessage(bob, directId);
    expect(record).toMatchObject({
      type: 'CALL',
      call: { id: join.call.id, status: 'ENDED', participantsCount: 2 },
    });

    const ended = await alice.agent.post(`/api/calls/${join.call.id}/join`).expect(409);
    expect(ended.body.code).toBe('CALL_ENDED');
  });

  it('declining a ringing 1:1 call makes it missed', async () => {
    const res = await start(alice, directId, 'AUDIO').expect(201);
    await bob.agent.post(`/api/calls/${res.body.call.id}/decline`).expect(204);
    expect(await callStatus(res.body.call.id)).toBe('MISSED');
    expect((await lastMessage(alice, directId))?.call).toMatchObject({
      status: 'MISSED',
      type: 'AUDIO',
    });
  });

  it('misses a 1:1 call nobody answers', async () => {
    const calls = app.get(CallsService);
    const original = calls.ringTimeoutMs;
    calls.ringTimeoutMs = 300;
    try {
      const res = await start(alice, directId).expect(201);
      await wait(800);
      expect(await callStatus(res.body.call.id)).toBe('MISSED');
    } finally {
      calls.ringTimeoutMs = original;
    }
  });

  it('marks a call to a busy user as missed right away', async () => {
    const first = await start(alice, directId).expect(201);
    const second = await start(carol, carolBobId).expect(201);
    expect(second.body.call.status).toBe('MISSED');
    await alice.agent.post(`/api/calls/${first.body.call.id}/leave`).expect(204);
  });

  it('keeps a group call alive until the last participant leaves', async () => {
    const res = await start(alice, groupId).expect(201);
    const callId = res.body.call.id as string;
    expect(res.body.call.status).toBe('ACTIVE');

    await bob.agent.post(`/api/calls/${callId}/join`).expect(200);
    await alice.agent.post(`/api/calls/${callId}/leave`).expect(204);
    expect(await callStatus(callId)).toBe('ACTIVE');

    // leave and come back
    await alice.agent.post(`/api/calls/${callId}/join`).expect(200);
    await alice.agent.post(`/api/calls/${callId}/leave`).expect(204);
    // decline is a no-op for groups
    await carol.agent.post(`/api/calls/${callId}/decline`).expect(204);
    expect(await callStatus(callId)).toBe('ACTIVE');

    await bob.agent.post(`/api/calls/${callId}/leave`).expect(204);
    expect(await callStatus(callId)).toBe('ENDED');
    expect((await lastMessage(carol, groupId))?.call).toMatchObject({
      id: callId,
      participantsCount: 2,
    });
  });

  it('only members can start or join', async () => {
    const res = await start(alice, directId).expect(201);
    const join = await carol.agent.post(`/api/calls/${res.body.call.id}/join`).expect(404);
    expect(join.body.code).toBe('CALL_NOT_FOUND');
    await start(carol, directId).expect(404);
    await alice.agent.post(`/api/calls/${res.body.call.id}/leave`).expect(204);
  });

  it('validates the call type', async () => {
    const res = await start(alice, directId, 'HOLOGRAM').expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  describe('LiveKit webhook', () => {
    it('rejects an unsigned request', async () => {
      await sendWebhook({ event: 'room_finished', room: { name: 'call_x' } }, 401, false);
    });

    it('ends a 1:1 call when a participant leaves the room', async () => {
      const res = await start(alice, directId).expect(201);
      const call = res.body.call as CallJoin['call'];
      await bob.agent.post(`/api/calls/${call.id}/join`).expect(200);

      await sendWebhook(
        {
          event: 'participant_left',
          room: { name: call.roomName },
          participant: { identity: bob.id },
        },
        204,
      );
      expect(await callStatus(call.id)).toBe('ENDED');
    });

    it('ends a group call when the room is finished', async () => {
      const res = await start(alice, groupId).expect(201);
      const call = res.body.call as CallJoin['call'];
      await sendWebhook(
        {
          event: 'participant_joined',
          room: { name: call.roomName },
          participant: { identity: carol.id },
        },
        204,
      );
      const participant = await prisma.callParticipant.findUnique({
        where: { callId_userId: { callId: call.id, userId: carol.id } },
      });
      expect(participant?.leftAt).toBeNull();

      await sendWebhook({ event: 'room_finished', room: { name: call.roomName } }, 204);
      expect(await callStatus(call.id)).toBe('ENDED');
    });
  });
});
