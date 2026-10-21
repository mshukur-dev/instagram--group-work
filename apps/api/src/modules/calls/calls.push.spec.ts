import { buildCallEndedPush, buildIncomingCallPush, type CallPushInput } from './calls.push';

describe('call pushes', () => {
  const input: CallPushInput = {
    callId: 'k1',
    conversationId: 'c1',
    isGroup: false,
    type: 'VIDEO',
    callerUsername: 'ivan',
    callerAvatarUrl: null,
  };

  it('incoming 1:1 call carries the call id for Accept / Decline', () => {
    expect(buildIncomingCallPush('EN', input)).toEqual({
      type: 'CALL',
      title: 'Instagram',
      body: 'ivan is calling you…',
      icon: null,
      url: '/direct/t/c1?joinCall=k1',
      tag: 'call:k1',
      callId: 'k1',
    });
    expect(buildIncomingCallPush('RU', input).body).toBe('ivan звонит вам…');
  });

  it('group call says who started it', () => {
    expect(buildIncomingCallPush('EN', { ...input, isGroup: true }).body).toBe(
      'ivan started a video call',
    );
    expect(buildIncomingCallPush('RU', { ...input, isGroup: true, type: 'AUDIO' }).body).toBe(
      'ivan начал(а) аудиозвонок',
    );
  });

  it('call ended push replaces the incoming one by tag', () => {
    expect(buildCallEndedPush('k1', 'c1')).toMatchObject({ type: 'CALL_ENDED', tag: 'call:k1' });
  });
});
