'use client';

import { type ActiveCall, ServerEvent, type ServerToClientEvents } from '@instagram/shared';
import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { patchConversation } from '@/features/direct/cache';
import { useMe } from '@/features/profile/queries';
import { connectSocket } from '@/lib/socket';
import { leaveCallOnUnload } from '../api';
import { useCallStore } from '../call-store';
import { endSession } from '../queries';
import { GroupCallBanners } from './group-call-banners';
import { IncomingCallDialog } from './incoming-call-dialog';

// LiveKit is heavy: the call screen is only downloaded when a call starts
const CallScreen = dynamic(() => import('./call-screen').then((m) => m.CallScreen), {
  ssr: false,
});

// Ringing that never got an answer or a cancel (lost event) disappears after this long
const INCOMING_SAFETY_MS = 40_000;

// Mounted once in the main layout: turns call:* socket events into the call store and the
// chats' "call in progress" state, and draws the incoming call, group banners and the call.
export function CallLayer() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const meId = me?.id;
  const session = useCallStore((s) => s.session);

  useEffect(() => {
    if (!meId) return;
    const socket = connectSocket();
    const store = useCallStore.getState;
    let safety: ReturnType<typeof setTimeout>;

    const setActiveCall = (conversationId: string, activeCall: ActiveCall | null) =>
      patchConversation(queryClient, conversationId, (c) => ({ ...c, activeCall }));

    const onIncoming: ServerToClientEvents[typeof ServerEvent.CALL_INCOMING] = (incoming) => {
      const { call, conversation, caller } = incoming;
      setActiveCall(call.conversationId, {
        id: call.id,
        type: call.type,
        status: call.status,
        participantIds: [caller.id],
      });
      if (caller.id === meId || store().session?.callId === call.id) return;
      // Calls muted in this chat don't ring (the chat still shows its "Join" button)
      if (conversation.muted.calls) return;
      if (conversation.isGroup) {
        store().addGroupInvite(incoming);
        return;
      }
      if (store().session) return; // busy: the server already marks it missed
      store().setIncoming(incoming);
      clearTimeout(safety);
      safety = setTimeout(() => {
        if (store().incoming?.call.id === call.id) store().setIncoming(null);
      }, INCOMING_SAFETY_MS);
    };

    const onUpdated: ServerToClientEvents[typeof ServerEvent.CALL_UPDATED] = ({
      callId,
      conversationId,
      status,
      participantIds,
    }) => {
      const session = store().session;
      patchConversation(queryClient, conversationId, (c) => ({
        ...c,
        activeCall: {
          id: callId,
          type: c.activeCall?.type ?? session?.type ?? 'AUDIO',
          status,
          participantIds,
        },
      }));
      // They picked up
      if (session?.callId === callId && session.phase === 'ringing' && status === 'ACTIVE') {
        store().patchSession({ phase: 'active', answeredAt: Date.now() });
      }
      // Answered in my other tab: stop ringing here
      const incoming = store().incoming;
      if (incoming?.call.id === callId && meId && participantIds.includes(meId)) {
        store().setIncoming(null);
      }
    };

    const onEnded: ServerToClientEvents[typeof ServerEvent.CALL_ENDED] = ({
      callId,
      conversationId,
    }) => {
      setActiveCall(conversationId, null);
      if (store().incoming?.call.id === callId) store().setIncoming(null);
      store().dropGroupInvite(callId);
      endSession(callId);
    };

    socket.on(ServerEvent.CALL_INCOMING, onIncoming);
    socket.on(ServerEvent.CALL_UPDATED, onUpdated);
    socket.on(ServerEvent.CALL_ENDED, onEnded);
    return () => {
      socket.off(ServerEvent.CALL_INCOMING, onIncoming);
      socket.off(ServerEvent.CALL_UPDATED, onUpdated);
      socket.off(ServerEvent.CALL_ENDED, onEnded);
      clearTimeout(safety);
    };
  }, [meId, queryClient]);

  // Closing the tab mid-call hangs up (LiveKit's webhook would notice too, later)
  const liveCallId = session && session.phase !== 'ended' ? session.callId : null;
  useEffect(() => {
    if (!liveCallId) return;
    const onUnload = () => void leaveCallOnUnload(liveCallId);
    window.addEventListener('pagehide', onUnload);
    return () => window.removeEventListener('pagehide', onUnload);
  }, [liveCallId]);

  return (
    <>
      <IncomingCallDialog />
      <GroupCallBanners />
      {session && <CallScreen />}
    </>
  );
}
