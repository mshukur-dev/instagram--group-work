import type { CallType, Language, PushPayload } from '@instagram/shared';

export type CallPushInput = {
  callId: string;
  conversationId: string;
  isGroup: boolean;
  type: CallType;
  callerUsername: string;
  callerAvatarUrl: string | null;
};

type Texts = {
  title: string;
  incoming: (user: string) => string;
  groupVideo: (user: string) => string;
  groupAudio: (user: string) => string;
};

export const callPushTexts: Record<Language, Texts> = {
  EN: {
    title: 'Instagram',
    incoming: (user) => `${user} is calling you…`,
    groupVideo: (user) => `${user} started a video call`,
    groupAudio: (user) => `${user} started an audio call`,
  },
  RU: {
    title: 'Instagram',
    incoming: (user) => `${user} звонит вам…`,
    groupVideo: (user) => `${user} начал(а) видеозвонок`,
    groupAudio: (user) => `${user} начал(а) аудиозвонок`,
  },
};

const callTag = (callId: string) => `call:${callId}`;

/** Incoming call push with Accept / Decline (docs/spec/push.md §4–5). */
export function buildIncomingCallPush(language: Language, input: CallPushInput): PushPayload {
  const t = callPushTexts[language];
  const user = input.callerUsername;
  let body = t.incoming(user);
  if (input.isGroup) body = input.type === 'VIDEO' ? t.groupVideo(user) : t.groupAudio(user);
  return {
    type: 'CALL',
    title: t.title,
    body,
    icon: input.callerAvatarUrl,
    url: `/direct/t/${input.conversationId}?joinCall=${input.callId}`,
    tag: callTag(input.callId),
    callId: input.callId,
  };
}

/** Silent push: the service worker closes the incoming call notification with this tag. */
export function buildCallEndedPush(callId: string, conversationId: string): PushPayload {
  return {
    type: 'CALL_ENDED',
    title: '',
    body: '',
    icon: null,
    url: `/direct/t/${conversationId}`,
    tag: callTag(callId),
    callId,
  };
}
