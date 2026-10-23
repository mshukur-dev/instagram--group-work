import type { INestApplication } from '@nestjs/common';
import type { Conversation, ConversationPreview, Message, Page } from '@instagram/shared';
import type { PrismaService } from '../src/prisma/prisma.service';
import { type TestUser, cleanupUsers, createTestApp, registerUser } from './direct-helpers';

/**
 * Direct: conversations, messages, groups (DM-1, DM-2, DM-4, DM-6, DM-8…DM-11).
 * Requires the dev database (pnpm db:up). Run: pnpm --filter api test:e2e
 */
describe('Direct (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let dave: TestUser;
  let directId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    alice = await registerUser(app, 'dm_alice');
    bob = await registerUser(app, 'dm_bob');
    carol = await registerUser(app, 'dm_carol');
    dave = await registerUser(app, 'dm_dave');
  });

  afterAll(async () => {
    await cleanupUsers(prisma, [alice, bob, carol, dave]);
    await app.close();
  });

  describe('1:1', () => {
    it('finds or creates exactly one chat per pair', async () => {
      const res = await alice.agent.post(`/api/conversations/direct/${bob.id}`).expect(200);
      const conversation = res.body as Conversation;
      expect(conversation).toMatchObject({
        isGroup: false,
        title: bob.username,
        otherUser: { id: bob.id, username: bob.username },
        myRole: 'MEMBER',
        unreadCount: 0,
        lastMessage: null,
        activeCall: null,
      });
      expect(conversation.members.map((m) => m.id).sort()).toEqual([alice.id, bob.id].sort());
      directId = conversation.id;

      const again = await bob.agent.post(`/api/conversations/direct/${alice.id}`).expect(200);
      expect(again.body.id).toBe(directId);
    });

    it("can't message yourself or a missing user", async () => {
      await alice.agent.post(`/api/conversations/direct/${alice.id}`).expect(400);
      const res = await alice.agent.post('/api/conversations/direct/nope').expect(404);
      expect(res.body.code).toBe('USER_NOT_FOUND');
    });

    it('hides an empty 1:1 chat from the list', async () => {
      const res = await alice.agent.get('/api/conversations').expect(200);
      const ids = (res.body as Page<ConversationPreview>).items.map((c) => c.id);
      expect(ids).not.toContain(directId);
    });

    it('sends a message, echoes clientId and updates previews', async () => {
      const res = await alice.agent
        .post(`/api/conversations/${directId}/messages`)
        .send({ type: 'TEXT', text: 'hey bob', clientId: 'tmp-1' })
        .expect(201);
      const message = res.body as Message;
      expect(message).toMatchObject({
        conversationId: directId,
        clientId: 'tmp-1',
        type: 'TEXT',
        text: 'hey bob',
        sender: { id: alice.id },
        isDeleted: false,
        reactions: [],
        systemData: null,
      });

      const list = await bob.agent.get('/api/conversations').expect(200);
      const preview = (list.body as Page<ConversationPreview>).items.find((c) => c.id === directId);
      expect(preview).toMatchObject({
        title: alice.username,
        unreadCount: 1,
        lastMessage: { id: message.id, text: 'hey bob', senderUsername: alice.username },
      });

      const unread = await bob.agent.get('/api/conversations/unread-count').expect(200);
      expect(unread.body.count).toBeGreaterThanOrEqual(1);
    });

    it('lists messages newest first with a cursor', async () => {
      await bob.agent
        .post(`/api/conversations/${directId}/messages`)
        .send({ type: 'TEXT', text: 'hi alice' })
        .expect(201);
      await alice.agent
        .post(`/api/conversations/${directId}/messages`)
        .send({ type: 'TEXT', text: 'third' })
        .expect(201);

      const first = await alice.agent
        .get(`/api/conversations/${directId}/messages?limit=2`)
        .expect(200);
      const page = first.body as Page<Message>;
      expect(page.items.map((m) => m.text)).toEqual(['third', 'hi alice']);
      expect(page.items[0]?.clientId).toBeNull();
      expect(page.nextCursor).toBeTruthy();

      const second = await alice.agent
        .get(`/api/conversations/${directId}/messages?limit=2&cursor=${page.nextCursor}`)
        .expect(200);
      expect((second.body as Page<Message>).items.map((m) => m.text)).toEqual(['hey bob']);
      expect(second.body.nextCursor).toBeNull();
    });

    it('marks the chat as read', async () => {
      await alice.agent.post(`/api/conversations/${directId}/read`).expect(204);
      const res = await alice.agent.get(`/api/conversations/${directId}`).expect(200);
      expect(res.body.unreadCount).toBe(0);
    });

    it('replies, reacts (one per user) and deletes own messages only', async () => {
      const original = await bob.agent
        .post(`/api/conversations/${directId}/messages`)
        .send({ type: 'TEXT', text: 'reply to me' })
        .expect(201);
      const reply = await alice.agent
        .post(`/api/conversations/${directId}/messages`)
        .send({ type: 'TEXT', text: 'replying', replyToId: original.body.id })
        .expect(201);
      expect(reply.body.replyTo).toMatchObject({ id: original.body.id, text: 'reply to me' });

      await alice.agent
        .put(`/api/messages/${original.body.id}/reaction`)
        .send({ emoji: '❤️' })
        .expect(204);
      await alice.agent
        .put(`/api/messages/${original.body.id}/reaction`)
        .send({ emoji: '😂' })
        .expect(204);
      let list = await bob.agent.get(`/api/conversations/${directId}/messages?limit=5`).expect(200);
      let msg = (list.body as Page<Message>).items.find((m) => m.id === original.body.id);
      expect(msg?.reactions).toEqual([{ emoji: '😂', userId: alice.id }]);

      await alice.agent.delete(`/api/messages/${original.body.id}/reaction`).expect(204);

      const forbidden = await alice.agent.delete(`/api/messages/${original.body.id}`).expect(403);
      expect(forbidden.body.code).toBe('FORBIDDEN');
      await bob.agent.delete(`/api/messages/${original.body.id}`).expect(204);

      list = await alice.agent.get(`/api/conversations/${directId}/messages?limit=5`).expect(200);
      msg = (list.body as Page<Message>).items.find((m) => m.id === original.body.id);
      expect(msg).toMatchObject({ isDeleted: true, text: null, reactions: [] });
    });

    it('rejects a shared post that does not exist', async () => {
      const res = await alice.agent
        .post(`/api/conversations/${directId}/messages`)
        .send({ type: 'POST_SHARE', postId: 'missing-post' })
        .expect(404);
      expect(res.body.code).toBe('POST_NOT_FOUND');
    });

    it('sends a voice message with its length and waveform', async () => {
      const mediaUrl = 'https://res.cloudinary.com/demo/video/upload/v1/messages/voice.webm';
      const res = await alice.agent
        .post(`/api/conversations/${directId}/messages`)
        .send({ type: 'VOICE', mediaUrl, voice: { duration: 4.2, waveform: [5, 60, 100, 30] } })
        .expect(201);
      expect(res.body).toMatchObject({
        type: 'VOICE',
        mediaUrl,
        mediaType: null,
        voice: { duration: 4.2, waveform: [5, 60, 100, 30] },
      });

      // Audio is required, and the length is capped
      await alice.agent
        .post(`/api/conversations/${directId}/messages`)
        .send({ type: 'VOICE', mediaUrl })
        .expect(400);
      await alice.agent
        .post(`/api/conversations/${directId}/messages`)
        .send({ type: 'VOICE', mediaUrl, voice: { duration: 600, waveform: [1] } })
        .expect(400);
    });

    it('rejects invalid messages with VALIDATION_FAILED', async () => {
      const res = await alice.agent
        .post(`/api/conversations/${directId}/messages`)
        .send({ type: 'TEXT' })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('hides chats from strangers', async () => {
      const res = await carol.agent.get(`/api/conversations/${directId}/messages`).expect(404);
      expect(res.body.code).toBe('CONVERSATION_NOT_FOUND');
      await carol.agent
        .post(`/api/conversations/${directId}/messages`)
        .send({ type: 'TEXT', text: 'intruder' })
        .expect(404);
    });

    it('sends to a user without a chat id and creates the chat', async () => {
      const res = await carol.agent
        .post(`/api/conversations/direct/${dave.id}/messages`)
        .send({ type: 'TEXT', text: 'hello dave' })
        .expect(201);
      const opened = await dave.agent.post(`/api/conversations/direct/${carol.id}`).expect(200);
      expect(opened.body.id).toBe(res.body.conversationId);
      expect(opened.body.lastMessage.text).toBe('hello dave');
    });

    it('respects messagePermission FOLLOWING for new chats only', async () => {
      await prisma.user.update({
        where: { id: dave.id },
        data: { messagePermission: 'FOLLOWING' },
      });
      try {
        const res = await alice.agent.post(`/api/conversations/direct/${dave.id}`).expect(403);
        expect(res.body.code).toBe('MESSAGING_NOT_ALLOWED');
        // existing chat keeps working
        await carol.agent.post(`/api/conversations/direct/${dave.id}`).expect(200);
        // following the sender unlocks it
        await prisma.follow.create({
          data: { followerId: dave.id, followingId: alice.id, status: 'ACCEPTED' },
        });
        await alice.agent.post(`/api/conversations/direct/${dave.id}`).expect(200);
      } finally {
        await prisma.user.update({
          where: { id: dave.id },
          data: { messagePermission: 'EVERYONE' },
        });
        await prisma.follow.deleteMany({ where: { followerId: dave.id } });
      }
    });

    it('blocks messaging in both directions', async () => {
      await prisma.block.create({ data: { blockerId: bob.id, blockedId: alice.id } });
      try {
        const res = await alice.agent
          .post(`/api/conversations/${directId}/messages`)
          .send({ type: 'TEXT', text: 'are you there?' })
          .expect(403);
        expect(res.body.code).toBe('MESSAGING_NOT_ALLOWED');
        await alice.agent.post(`/api/conversations/direct/${bob.id}`).expect(404);
      } finally {
        await prisma.block.deleteMany({ where: { blockerId: bob.id } });
      }
    });
  });

  describe('groups', () => {
    let groupId: string;

    it('creates a group with the creator as admin and a system message', async () => {
      const res = await alice.agent
        .post('/api/conversations/group')
        .send({ title: 'Team', memberIds: [bob.id, carol.id] })
        .expect(201);
      const group = res.body as Conversation;
      groupId = group.id;
      expect(group).toMatchObject({
        isGroup: true,
        title: 'Team',
        myRole: 'ADMIN',
        otherUser: null,
      });
      expect(group.members).toHaveLength(3);
      expect(group.lastMessage?.type).toBe('SYSTEM');

      const messages = await bob.agent.get(`/api/conversations/${groupId}/messages`).expect(200);
      const system = (messages.body as Page<Message>).items[0];
      expect(system?.systemData).toMatchObject({
        action: 'GROUP_CREATED',
        actor: { id: alice.id },
        title: 'Team',
      });
      expect(system?.systemData?.targets.map((t) => t.id).sort()).toEqual(
        [bob.id, carol.id].sort(),
      );
    });

    it('needs at least two other members', async () => {
      await alice.agent
        .post('/api/conversations/group')
        .send({ memberIds: [bob.id, bob.id] })
        .expect(400);
    });

    it('lets only the admin rename the group', async () => {
      const denied = await bob.agent
        .patch(`/api/conversations/${groupId}`)
        .send({ title: 'Nope' })
        .expect(403);
      expect(denied.body.code).toBe('NOT_GROUP_ADMIN');

      const res = await alice.agent
        .patch(`/api/conversations/${groupId}`)
        .send({ title: 'Dream team' })
        .expect(200);
      expect(res.body.title).toBe('Dream team');
      expect(res.body.lastMessage.type).toBe('SYSTEM');

      const notGroup = await alice.agent
        .patch(`/api/conversations/${directId}`)
        .send({ title: 'x' })
        .expect(400);
      expect(notGroup.body.code).toBe('NOT_A_GROUP');
    });

    it('adds and removes members', async () => {
      await alice.agent
        .post(`/api/conversations/${groupId}/members`)
        .send({ userIds: [dave.id] })
        .expect(204);
      await bob.agent
        .post(`/api/conversations/${groupId}/members`)
        .send({ userIds: [dave.id] })
        .expect(403);
      await alice.agent.delete(`/api/conversations/${groupId}/members/${carol.id}`).expect(204);

      const res = await alice.agent.get(`/api/conversations/${groupId}`).expect(200);
      expect((res.body as Conversation).members.map((m) => m.id).sort()).toEqual(
        [alice.id, bob.id, dave.id].sort(),
      );

      const removed = await carol.agent.get(`/api/conversations/${groupId}`).expect(403);
      expect(removed.body.code).toBe('NOT_A_MEMBER');
      const list = await carol.agent.get('/api/conversations').expect(200);
      expect((list.body as Page<ConversationPreview>).items.map((c) => c.id)).not.toContain(
        groupId,
      );
    });

    it('passes the admin role on when the admin leaves', async () => {
      await alice.agent.delete(`/api/conversations/${groupId}/members/${alice.id}`).expect(204);
      const res = await bob.agent.get(`/api/conversations/${groupId}`).expect(200);
      expect(res.body.myRole).toBe('ADMIN');

      const messages = await bob.agent
        .get(`/api/conversations/${groupId}/messages?limit=1`)
        .expect(200);
      expect(messages.body.items[0].systemData).toMatchObject({
        action: 'MEMBER_LEFT',
        actor: { id: alice.id },
      });
    });

    it('brings a former member back', async () => {
      await bob.agent
        .post(`/api/conversations/${groupId}/members`)
        .send({ userIds: [alice.id] })
        .expect(204);
      const res = await alice.agent.get(`/api/conversations/${groupId}`).expect(200);
      expect(res.body.myRole).toBe('MEMBER');
    });
  });

  describe('delete chat', () => {
    let chatId: string;

    it('hides a 1:1 chat and its history only for the one who deleted it', async () => {
      const opened = await dave.agent.post(`/api/conversations/direct/${carol.id}`).expect(200);
      chatId = opened.body.id as string;
      await dave.agent.delete(`/api/conversations/${chatId}`).expect(204);

      const daveList = await dave.agent.get('/api/conversations').expect(200);
      expect((daveList.body as Page<ConversationPreview>).items.map((c) => c.id)).not.toContain(
        chatId,
      );
      const daveMessages = await dave.agent
        .get(`/api/conversations/${chatId}/messages`)
        .expect(200);
      expect(daveMessages.body.items).toEqual([]);
      const daveChat = await dave.agent.get(`/api/conversations/${chatId}`).expect(200);
      expect(daveChat.body.lastMessage).toBeNull();

      // carol keeps everything
      const carolMessages = await carol.agent
        .get(`/api/conversations/${chatId}/messages`)
        .expect(200);
      expect((carolMessages.body as Page<Message>).items.map((m) => m.text)).toContain(
        'hello dave',
      );
    });

    it('brings the chat back, empty before it, when a new message comes', async () => {
      await carol.agent
        .post(`/api/conversations/${chatId}/messages`)
        .send({ type: 'TEXT', text: 'still there?' })
        .expect(201);

      const list = await dave.agent.get('/api/conversations').expect(200);
      const preview = (list.body as Page<ConversationPreview>).items.find((c) => c.id === chatId);
      expect(preview).toMatchObject({ unreadCount: 1, lastMessage: { text: 'still there?' } });
      const messages = await dave.agent.get(`/api/conversations/${chatId}/messages`).expect(200);
      expect((messages.body as Page<Message>).items.map((m) => m.text)).toEqual(['still there?']);
    });

    it('leaves a group when its chat is deleted', async () => {
      const group = await carol.agent
        .post('/api/conversations/group')
        .send({ memberIds: [dave.id, bob.id] })
        .expect(201);
      const groupId = group.body.id as string;
      await dave.agent.delete(`/api/conversations/${groupId}`).expect(204);

      const gone = await dave.agent.get(`/api/conversations/${groupId}`).expect(403);
      expect(gone.body.code).toBe('NOT_A_MEMBER');
      const messages = await carol.agent
        .get(`/api/conversations/${groupId}/messages?limit=1`)
        .expect(200);
      expect(messages.body.items[0].systemData).toMatchObject({
        action: 'MEMBER_LEFT',
        actor: { id: dave.id },
      });
    });
  });

  describe('mute', () => {
    it('mutes messages and calls of a chat only for me', async () => {
      const res = await alice.agent
        .put(`/api/conversations/${directId}/mute`)
        .send({ messages: true })
        .expect(200);
      expect(res.body.muted).toEqual({ messages: true, calls: false });

      const both = await alice.agent
        .put(`/api/conversations/${directId}/mute`)
        .send({ calls: true })
        .expect(200);
      expect(both.body.muted).toEqual({ messages: true, calls: true });

      const bobSide = await bob.agent.get(`/api/conversations/${directId}`).expect(200);
      expect(bobSide.body.muted).toEqual({ messages: false, calls: false });

      await alice.agent
        .put(`/api/conversations/${directId}/mute`)
        .send({ messages: false, calls: false })
        .expect(200);
    });

    it('needs at least one switch', async () => {
      await alice.agent.put(`/api/conversations/${directId}/mute`).send({}).expect(400);
    });
  });
});
