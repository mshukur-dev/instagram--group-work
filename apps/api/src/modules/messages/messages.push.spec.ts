import { buildMessagePush, type MessagePushInput } from './messages.push';

describe('buildMessagePush', () => {
  const base: MessagePushInput = {
    conversationId: 'c1',
    groupTitle: null,
    senderUsername: 'ivan',
    senderAvatarUrl: 'https://img/ivan.jpg',
    type: 'TEXT',
    text: 'hey, how are you?',
    mediaType: null,
  };

  it('builds "user: text" with a per-conversation tag', () => {
    expect(buildMessagePush('EN', base)).toEqual({
      type: 'MESSAGE',
      title: 'ivan',
      body: 'ivan: hey, how are you?',
      icon: 'https://img/ivan.jpg',
      url: '/direct/t/c1',
      tag: 'conversation:c1',
    });
  });

  it('uses the group title and the recipient language', () => {
    const push = buildMessagePush('RU', {
      ...base,
      groupTitle: 'Team',
      type: 'MEDIA',
      mediaType: 'VIDEO',
      text: null,
    });
    expect(push.title).toBe('Team');
    expect(push.body).toBe('ivan отправил(а) видео');
  });

  it('describes non-text messages and truncates long text', () => {
    expect(
      buildMessagePush('EN', { ...base, type: 'MEDIA', mediaType: 'IMAGE', text: null }).body,
    ).toBe('ivan sent a photo');
    expect(buildMessagePush('EN', { ...base, type: 'POST_SHARE', text: null }).body).toBe(
      'ivan sent a post',
    );
    expect(buildMessagePush('EN', { ...base, type: 'STORY_REPLY', text: 'wow' }).body).toBe(
      'ivan replied to your story: wow',
    );
    expect(buildMessagePush('RU', { ...base, type: 'VOICE', text: null }).body).toBe(
      'ivan отправил(а) голосовое сообщение',
    );
    const long = buildMessagePush('EN', { ...base, text: 'x'.repeat(500) }).body;
    expect(long.length).toBeLessThan(120);
    expect(long.endsWith('…')).toBe(true);
  });
});
