import type { Post, Story, UserPreview } from '@instagram/shared';
import { type MessageRow, parseSystemData, toMessageDto } from './messages.mapper';

const user = (id: string): UserPreview => ({
  id,
  username: id,
  fullName: id,
  avatarUrl: null,
  hasActiveStory: false,
  hasUnseenStory: false,
});

const row = (overrides: Partial<MessageRow> = {}): MessageRow => ({
  id: 'm1',
  conversationId: 'c1',
  senderId: 'u1',
  type: 'TEXT',
  text: 'hello',
  mediaUrl: null,
  mediaType: null,
  voiceDuration: null,
  voiceWaveform: [],
  postId: null,
  storyId: null,
  callId: null,
  replyToId: null,
  systemData: null,
  deletedAt: null,
  createdAt: new Date('2026-10-21T10:00:00Z'),
  sender: { id: 'u1', username: 'u1', fullName: 'u1', avatarUrl: null },
  replyTo: null,
  reactions: [{ emoji: '❤️', userId: 'u2' }],
  call: null,
  ...overrides,
});

const ctx = {
  users: new Map([
    ['u1', user('u1')],
    ['u2', user('u2')],
  ]),
  posts: new Map<string, Post>(),
  stories: new Map<string, Story>(),
};

describe('toMessageDto', () => {
  it('maps a text message', () => {
    expect(toMessageDto(row(), { ...ctx, clientId: 'tmp' })).toMatchObject({
      id: 'm1',
      clientId: 'tmp',
      sender: { id: 'u1' },
      text: 'hello',
      reactions: [{ emoji: '❤️', userId: 'u2' }],
      isDeleted: false,
      createdAt: '2026-10-21T10:00:00.000Z',
    });
  });

  it('hides the content of a deleted message', () => {
    const dto = toMessageDto(
      row({ deletedAt: new Date(), mediaUrl: 'x', mediaType: 'IMAGE' }),
      ctx,
    );
    expect(dto).toMatchObject({
      isDeleted: true,
      text: null,
      mediaUrl: null,
      mediaType: null,
      reactions: [],
    });
  });

  it('maps a voice message, and hides it once unsent', () => {
    const voice = row({
      type: 'VOICE',
      text: null,
      mediaUrl: 'https://res.cloudinary.com/x/video/upload/v1/a.webm',
      voiceDuration: 3.4,
      voiceWaveform: [10, 80, 40],
    });
    expect(toMessageDto(voice, ctx).voice).toEqual({ duration: 3.4, waveform: [10, 80, 40] });
    expect(toMessageDto({ ...voice, deletedAt: new Date() }, ctx).voice).toBeNull();
    expect(toMessageDto(row(), ctx).voice).toBeNull();
  });

  it('maps a shared post the viewer cannot see to null', () => {
    expect(toMessageDto(row({ type: 'POST_SHARE', postId: 'p1' }), ctx).post).toBeNull();
  });

  it('resolves system message users and drops deleted ones', () => {
    const dto = toMessageDto(
      row({
        type: 'SYSTEM',
        text: null,
        systemData: { action: 'MEMBER_ADDED', actorId: 'u1', targetIds: ['u2', 'gone'] },
      }),
      ctx,
    );
    expect(dto.systemData).toEqual({
      action: 'MEMBER_ADDED',
      actor: user('u1'),
      targets: [user('u2')],
    });
  });
});

describe('parseSystemData', () => {
  it('ignores malformed JSON', () => {
    expect(parseSystemData(null)).toBeNull();
    expect(parseSystemData([1, 2])).toBeNull();
    expect(parseSystemData({ action: 1 })).toBeNull();
  });
});
