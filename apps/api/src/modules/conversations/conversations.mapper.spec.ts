import type { UserPreview } from '@instagram/shared';
import {
  type ConversationRow,
  toConversation,
  toConversationPreview,
} from './conversations.mapper';

const member = (
  userId: string,
  role: 'ADMIN' | 'MEMBER' = 'MEMBER',
  avatarUrl: string | null = null,
) => ({
  conversationId: 'c1',
  userId,
  role,
  lastReadAt: new Date('2026-10-21T10:00:00Z'),
  joinedAt: new Date('2026-10-21T09:00:00Z'),
  leftAt: null,
  clearedAt: null as Date | null,
  user: { id: userId, username: userId, fullName: userId, avatarUrl },
});

const row = (overrides: Partial<ConversationRow> = {}): ConversationRow => ({
  id: 'c1',
  isGroup: false,
  title: null,
  avatarUrl: null,
  lastMessageAt: new Date('2026-10-21T11:00:00Z'),
  createdAt: new Date('2026-10-21T09:00:00Z'),
  members: [member('me'), member('ivan', 'MEMBER', 'https://img/ivan.jpg')],
  messages: [],
  calls: [],
  ...overrides,
});

const users = new Map<string, UserPreview>();

describe('toConversationPreview', () => {
  it('1:1: title and avatar of the other user', () => {
    expect(toConversationPreview('me', row(), users, 3)).toMatchObject({
      title: 'ivan',
      avatarUrls: ['https://img/ivan.jpg'],
      otherUser: { id: 'ivan' },
      unreadCount: 3,
      lastMessage: null,
      activeCall: null,
    });
  });

  it('untitled group: usernames of the others', () => {
    const preview = toConversationPreview(
      'me',
      row({ isGroup: true, members: [member('me', 'ADMIN'), member('ivan'), member('maria')] }),
      users,
      0,
    );
    expect(preview).toMatchObject({ title: 'ivan, maria', otherUser: null });
  });

  it('group avatar wins and the active call is exposed', () => {
    const preview = toConversationPreview(
      'me',
      row({
        isGroup: true,
        title: 'Team',
        avatarUrl: 'https://img/team.jpg',
        calls: [
          {
            id: 'k1',
            conversationId: 'c1',
            startedById: 'ivan',
            type: 'VIDEO',
            status: 'ACTIVE',
            roomName: 'call_k1',
            startedAt: new Date(),
            answeredAt: new Date(),
            endedAt: null,
            participants: [{ userId: 'ivan' }],
          },
        ],
      }),
      users,
      0,
    );
    expect(preview.avatarUrls).toEqual(['https://img/team.jpg']);
    expect(preview.activeCall).toEqual({
      id: 'k1',
      type: 'VIDEO',
      status: 'ACTIVE',
      participantIds: ['ivan'],
    });
  });

  it('Conversation adds members and my role', () => {
    const conversation = toConversation(
      'me',
      row({ members: [member('me', 'ADMIN'), member('ivan')] }),
      users,
      0,
    );
    expect(conversation.myRole).toBe('ADMIN');
    expect(conversation.members.map((m) => [m.id, m.role])).toEqual([
      ['me', 'ADMIN'],
      ['ivan', 'MEMBER'],
    ]);
  });
});
