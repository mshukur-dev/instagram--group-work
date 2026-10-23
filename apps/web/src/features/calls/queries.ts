import {
  type CallJoin,
  type CallType,
  type ConversationPreview,
  ErrorCode,
} from '@instagram/shared';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { getErrorCode, getErrorDetails } from '@/lib/api-error';
import { playHangup } from '@/lib/tones';
import { declineCall, joinCall, leaveCall, startCall } from './api';
import { type CallSession, type IncomingCall, useCallStore } from './call-store';

const store = useCallStore.getState;

function sessionOf(
  join: CallJoin,
  conversation: ConversationPreview,
  phase: CallSession['phase'],
): CallSession {
  return {
    callId: join.call.id,
    conversationId: conversation.id,
    type: join.call.type,
    isGroup: conversation.isGroup,
    title: conversation.title,
    avatarUrls: conversation.avatarUrls,
    peer: conversation.otherUser,
    token: join.token,
    url: join.url,
    phase,
    answeredAt: join.call.answeredAt
      ? Date.parse(join.call.answeredAt)
      : phase === 'active'
        ? Date.now()
        : null,
  };
}

/** The call screen says "Call ended" for a moment, then closes. Safe to call twice. */
export function endSession(callId: string) {
  const { session, patchSession, setSession } = store();
  if (session?.callId !== callId || session.phase === 'ended') return;
  patchSession({ phase: 'ended' });
  playHangup();
  setTimeout(() => {
    if (store().session?.callId === callId) setSession(null);
  }, 1100);
}

// CALL-1…CALL-6: everything a button can do with a call. The server keeps the truth and tells
// every member through call:* socket events (handled in CallLayer).
export function useCallActions() {
  const t = useTranslations('calls');

  const failWith = (error: unknown) => {
    const code = getErrorCode(error);
    if (code === ErrorCode.CALL_FULL) toast.error(t('callFull'));
    else if (code === ErrorCode.CALL_ENDED) toast.error(t('callEnded'));
    else toast.error(t('failed'));
  };

  const join = async (callId: string, conversation: ConversationPreview) => {
    if (store().session) return void toast(t('alreadyInCall'));
    try {
      const joined = await joinCall(callId);
      store().dropGroupInvite(callId);
      if (store().incoming?.call.id === callId) store().setIncoming(null);
      store().setSession(sessionOf(joined, conversation, 'active'));
    } catch (error) {
      failWith(error);
    }
  };

  const start = async (conversation: ConversationPreview, type: CallType) => {
    if (store().session) return void toast(t('alreadyInCall'));
    try {
      const started = await startCall(conversation.id, type);
      const { status } = started.call;
      const phase = status === 'MISSED' ? 'busy' : status === 'RINGING' ? 'ringing' : 'active';
      store().setSession(sessionOf(started, conversation, phase));
      // "They're on another call", then the screen closes by itself
      if (phase === 'busy') setTimeout(() => endSession(started.call.id), 2400);
    } catch (error) {
      // a group call is already going on: join it instead
      const callId = getErrorDetails(error).callId;
      if (getErrorCode(error) === ErrorCode.CALL_ALREADY_ACTIVE && typeof callId === 'string') {
        await join(callId, conversation);
        return;
      }
      failWith(error);
    }
  };

  const accept = async (incoming: IncomingCall) => {
    store().setIncoming(null);
    await join(incoming.call.id, incoming.conversation);
  };

  const decline = (incoming: IncomingCall) => {
    store().setIncoming(null);
    void declineCall(incoming.call.id).catch(() => undefined);
  };

  const hangUp = () => {
    const session = store().session;
    if (!session || session.phase === 'ended') return;
    if (session.phase !== 'busy') void leaveCall(session.callId).catch(() => undefined);
    endSession(session.callId);
  };

  return { start, join, accept, decline, hangUp };
}
