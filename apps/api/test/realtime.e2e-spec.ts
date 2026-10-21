import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { type Socket, io } from 'socket.io-client';
import {
  ClientEvent,
  type ClientToServerEvents,
  type Message,
  type PresenceState,
  ServerEvent,
  type ServerToClientEvents,
} from '@instagram/shared';
import type { PrismaService } from '../src/prisma/prisma.service';
import { type TestUser, cleanupUsers, createTestApp, registerUser, wait } from './direct-helpers';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Socket.IO gateway: handshake auth, message delivery, typing, read receipts, presence
 * (DM-3, DM-5, DM-6, DM-7). Boots the app on a random port.
 */
describe('Realtime (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let url: string;
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let conversationId: string;
  const sockets: ClientSocket[] = [];

  const connect = async (user: TestUser): Promise<ClientSocket> => {
    const res = await user.agent.get('/api/auth/socket-token').expect(200);
    const socket: ClientSocket = io(url, {
      auth: { token: res.body.token as string },
      transports: ['websocket'],
      forceNew: true,
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    // the server finishes join + presence right after the handshake
    await wait(100);
    return socket;
  };

  /** Resolves with the next event payload, or rejects after a timeout. */
  const next = <E extends keyof ServerToClientEvents>(
    socket: ClientSocket,
    event: E,
    timeoutMs = 3000,
  ): Promise<Parameters<ServerToClientEvents[E]>[0]> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no ${event}`)), timeoutMs);
      const handler = (data: Parameters<ServerToClientEvents[E]>[0]) => {
        clearTimeout(timer);
        resolve(data);
      };
      // socket.io-client's typed `once` can't infer a generic event name
      (socket as unknown as { once: (e: string, h: (d: unknown) => void) => void }).once(
        event,
        handler as (d: unknown) => void,
      );
    });

  const silent = async (socket: ClientSocket, event: keyof ServerToClientEvents, ms = 400) => {
    let received = false;
    const handler = () => {
      received = true;
    };
    socket.on(event, handler);
    await wait(ms);
    socket.off(event, handler);
    return !received;
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = `http://localhost:${port}`;

    alice = await registerUser(app, 'rt_alice');
    bob = await registerUser(app, 'rt_bob');
    carol = await registerUser(app, 'rt_carol');
    const res = await alice.agent.post(`/api/conversations/direct/${bob.id}`).expect(200);
    conversationId = res.body.id as string;
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await cleanupUsers(prisma, [alice, bob, carol]);
    await app.close();
  });

  it('rejects a handshake without a valid token', async () => {
    const socket: ClientSocket = io(url, {
      auth: { token: 'bad' },
      transports: ['websocket'],
      forceNew: true,
    });
    sockets.push(socket);
    const error = await new Promise<Error>((resolve) => socket.once('connect_error', resolve));
    expect(error.message).toBe('UNAUTHORIZED');
  });

  it('delivers a REST message to the other member and the sender’s other tab', async () => {
    const aliceTab1 = await connect(alice);
    const aliceTab2 = await connect(alice);
    const bobSocket = await connect(bob);

    const bobGets = next(bobSocket, ServerEvent.MESSAGE_NEW);
    const aliceTabGets = next(aliceTab2, ServerEvent.MESSAGE_NEW);
    const res = await alice.agent
      .post(`/api/conversations/${conversationId}/messages`)
      .send({ type: 'TEXT', text: 'realtime!', clientId: 'c-1' })
      .expect(201);

    const delivered: Message = await bobGets;
    expect(delivered).toMatchObject({ id: res.body.id, text: 'realtime!', clientId: 'c-1' });
    expect((await aliceTabGets).id).toBe(res.body.id);
    aliceTab1.disconnect();
    aliceTab2.disconnect();
    bobSocket.disconnect();
    await wait(100);
  });

  it('relays typing only between members', async () => {
    const aliceSocket = await connect(alice);
    const bobSocket = await connect(bob);
    const carolSocket = await connect(carol);

    const bobGets = next(bobSocket, ServerEvent.TYPING);
    aliceSocket.emit(ClientEvent.TYPING, { conversationId, isTyping: true });
    expect(await bobGets).toEqual({ conversationId, userId: alice.id, isTyping: true });

    // a stranger's typing is ignored
    carolSocket.emit(ClientEvent.TYPING, { conversationId, isTyping: true });
    expect(await silent(bobSocket, ServerEvent.TYPING)).toBe(true);

    const readGets = next(aliceSocket, ServerEvent.CONVERSATION_READ);
    await bob.agent.post(`/api/conversations/${conversationId}/read`).expect(204);
    expect(await readGets).toMatchObject({ conversationId, userId: bob.id });

    [aliceSocket, bobSocket, carolSocket].forEach((s) => s.disconnect());
    await wait(100);
  });

  it('shares presence with chat partners only and saves lastSeenAt', async () => {
    const aliceSocket = await connect(alice);

    const onlineGets = next(aliceSocket, ServerEvent.PRESENCE);
    const bobSocket = await connect(bob);
    expect(await onlineGets).toEqual({ userId: bob.id, isOnline: true, lastSeenAt: null });

    const states = await new Promise<PresenceState[]>((resolve) =>
      aliceSocket.emit(ClientEvent.PRESENCE_SUBSCRIBE, { userIds: [bob.id, carol.id] }, resolve),
    );
    expect(states).toEqual([
      { userId: bob.id, isOnline: true, lastSeenAt: null },
      // no chat with carol → hidden
      { userId: carol.id, isOnline: false, lastSeenAt: null },
    ]);

    bobSocket.emit(ClientEvent.PRESENCE_FOCUS, { focused: false });

    const offlineGets = next(aliceSocket, ServerEvent.PRESENCE);
    bobSocket.disconnect();
    const offline = await offlineGets;
    expect(offline).toMatchObject({ userId: bob.id, isOnline: false });
    expect(offline.lastSeenAt).toEqual(expect.any(String));
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: bob.id } });
    expect(saved.lastSeenAt?.toISOString()).toBe(offline.lastSeenAt);

    aliceSocket.disconnect();
    await wait(100);
  });

  it('hides presence when showActivityStatus is off', async () => {
    await prisma.user.update({ where: { id: bob.id }, data: { showActivityStatus: false } });
    try {
      const aliceSocket = await connect(alice);
      const watcher = silent(aliceSocket, ServerEvent.PRESENCE, 600);
      const bobSocket = await connect(bob);
      expect(await watcher).toBe(true);

      const states = await new Promise<PresenceState[]>((resolve) =>
        aliceSocket.emit(ClientEvent.PRESENCE_SUBSCRIBE, { userIds: [bob.id] }, resolve),
      );
      expect(states).toEqual([{ userId: bob.id, isOnline: false, lastSeenAt: null }]);
      aliceSocket.disconnect();
      bobSocket.disconnect();
      await wait(100);
    } finally {
      await prisma.user.update({ where: { id: bob.id }, data: { showActivityStatus: true } });
    }
  });
});
