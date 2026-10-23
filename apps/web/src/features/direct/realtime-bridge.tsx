'use client';

import {
  ClientEvent,
  type Conversation,
  type ConversationPreview,
  type Me,
  type Page,
  ServerEvent,
  type ServerToClientEvents,
} from '@instagram/shared';
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useMe } from '@/features/profile/queries';
import { queryKeys } from '@/lib/query-keys';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import {
  patchConversation,
  patchMessage,
  putConversation,
  removeConversation,
  toPreview,
  upsertMessage,
} from './cache';
import { showMessageToast } from './components/message-toast';
import { useRealtimeStore } from './realtime-store';

// The person is looking at this tab: visible and the window in focus. Only visible is not enough:
// two browser windows side by side are both visible, and pushes would be swallowed.
const lookingAtTab = () => document.visibilityState === 'visible' && document.hasFocus();

// Someone who stopped typing without saying so (closed the tab) stops showing after this long
const TYPING_TIMEOUT_MS = 6000;

// Connects the tab's socket once the user is known and turns every server event into a change
// of the Query cache (messages, inbox, counters) or of the realtime store (typing, presence).
// Mounted once in the main layout; renders nothing.
export function RealtimeBridge() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const meId = me?.id;
  const t = useTranslations('direct');
  const router = useRouter();
  // Read from inside the socket handlers without reconnecting when they change
  const latest = useRef({ t, router });
  latest.current = { t, router };

  useEffect(() => {
    if (!meId) return;
    const socket = connectSocket();
    const store = useRealtimeStore.getState;
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    let connectedBefore = false;

    const isOpen = (conversationId: string) =>
      store().openConversationId === conversationId && document.visibilityState === 'visible';

    const unreadOf = (conversationId: string) =>
      queryClient
        .getQueryData<InfiniteData<Page<ConversationPreview>>>(queryKeys.conversations())
        ?.pages.flatMap((p) => p.items)
        .find((c) => c.id === conversationId)?.unreadCount ?? 0;

    const onConnect = () => {
      socket.emit(ClientEvent.PRESENCE_FOCUS, { focused: lookingAtTab() });
      // After a dropped connection, catch up on whatever happened meanwhile
      if (connectedBefore) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.conversations() });
        void queryClient.invalidateQueries({ queryKey: ['messages'] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      }
      connectedBefore = true;
    };

    const onMessage: ServerToClientEvents[typeof ServerEvent.MESSAGE_NEW] = (message) => {
      const mine = message.sender.id === meId;
      const counts = !mine && !isOpen(message.conversationId);
      const wasUnread = unreadOf(message.conversationId) > 0;
      upsertMessage(queryClient, message);
      patchConversation(
        queryClient,
        message.conversationId,
        (c) => ({
          ...c,
          lastMessage: toPreview(message),
          lastMessageAt: message.createdAt,
          unreadCount: counts ? c.unreadCount + 1 : c.unreadCount,
        }),
        true,
      );
      if (counts && !wasUnread) {
        queryClient.setQueryData<Me>(queryKeys.me(), (m) =>
          m ? { ...m, unreadConversationsCount: m.unreadConversationsCount + 1 } : m,
        );
      }
      store().setTyping(message.conversationId, message.sender.id, false);

      // PUSH-5: tab in front, another chat open → a card in the app instead of a system push
      if (counts && lookingAtTab()) {
        const { t, router } = latest.current;
        let text: string | null = message.text;
        if (message.type === 'MEDIA') text = t('preview.photo');
        if (message.type === 'POST_SHARE') text = t('preview.post');
        if (message.type === 'STORY_REPLY') text = message.text ?? t('preview.story');
        if (text && message.type !== 'SYSTEM' && message.type !== 'CALL') {
          const chat = queryClient
            .getQueryData<InfiniteData<Page<ConversationPreview>>>(queryKeys.conversations())
            ?.pages.flatMap((p) => p.items)
            .find((c) => c.id === message.conversationId);
          const group = chat?.isGroup;
          // a muted chat stays quiet
          if (!chat?.muted.messages)
            showMessageToast({
              message,
              title: group ? chat.title : message.sender.username,
              text: group ? `${message.sender.username}: ${text}` : text,
              onOpen: () => router.push(`/direct/t/${message.conversationId}`),
            });
        }
      }
    };

    const onDeleted: ServerToClientEvents[typeof ServerEvent.MESSAGE_DELETED] = ({
      conversationId,
      messageId,
    }) => {
      patchMessage(
        queryClient,
        conversationId,
        (m) => m.id === messageId,
        (m) => ({ ...m, isDeleted: true, text: null, reactions: [] }),
      );
      patchConversation(queryClient, conversationId, (c) =>
        c.lastMessage?.id === messageId
          ? { ...c, lastMessage: { ...c.lastMessage, isDeleted: true, text: null } }
          : c,
      );
    };

    const onReaction: ServerToClientEvents[typeof ServerEvent.MESSAGE_REACTION] = ({
      conversationId,
      messageId,
      reactions,
    }) =>
      patchMessage(
        queryClient,
        conversationId,
        (m) => m.id === messageId,
        (m) => ({ ...m, reactions }),
      );

    const onUpdated: ServerToClientEvents[typeof ServerEvent.CONVERSATION_UPDATED] = (preview) =>
      putConversation(queryClient, preview);

    // Removed from a group (or left it in another tab): an open chat turns into "not available"
    const onRemoved: ServerToClientEvents[typeof ServerEvent.CONVERSATION_REMOVED] = ({
      conversationId,
    }) => removeConversation(queryClient, conversationId, { refetchChat: true });

    // DM-7: "Seen" moves under the message the other person has now read
    const onRead: ServerToClientEvents[typeof ServerEvent.CONVERSATION_READ] = ({
      conversationId,
      userId,
      lastReadAt,
    }) =>
      queryClient.setQueryData<Conversation>(queryKeys.conversation(conversationId), (c) =>
        c
          ? {
              ...c,
              members: c.members.map((m) => (m.id === userId ? { ...m, lastReadAt } : m)),
            }
          : c,
      );

    // DM-5: "typing…" with a safety timeout
    const onTyping: ServerToClientEvents[typeof ServerEvent.TYPING] = ({
      conversationId,
      userId,
      isTyping,
    }) => {
      const key = `${conversationId}:${userId}`;
      clearTimeout(typingTimers.get(key));
      store().setTyping(conversationId, userId, isTyping);
      if (isTyping) {
        typingTimers.set(
          key,
          setTimeout(() => store().setTyping(conversationId, userId, false), TYPING_TIMEOUT_MS),
        );
      }
    };

    const onPresence: ServerToClientEvents[typeof ServerEvent.PRESENCE] = (state) =>
      store().setPresence([state]);

    // Web Push is only sent while no tab of mine is in front (docs/spec/push.md)
    const onVisibility = () => socket.emit(ClientEvent.PRESENCE_FOCUS, { focused: lookingAtTab() });

    socket.on('connect', onConnect);
    socket.on(ServerEvent.MESSAGE_NEW, onMessage);
    socket.on(ServerEvent.MESSAGE_DELETED, onDeleted);
    socket.on(ServerEvent.MESSAGE_REACTION, onReaction);
    socket.on(ServerEvent.CONVERSATION_UPDATED, onUpdated);
    socket.on(ServerEvent.CONVERSATION_REMOVED, onRemoved);
    socket.on(ServerEvent.CONVERSATION_READ, onRead);
    socket.on(ServerEvent.TYPING, onTyping);
    socket.on(ServerEvent.PRESENCE, onPresence);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    window.addEventListener('blur', onVisibility);
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off(ServerEvent.MESSAGE_NEW, onMessage);
      socket.off(ServerEvent.MESSAGE_DELETED, onDeleted);
      socket.off(ServerEvent.MESSAGE_REACTION, onReaction);
      socket.off(ServerEvent.CONVERSATION_UPDATED, onUpdated);
      socket.off(ServerEvent.CONVERSATION_REMOVED, onRemoved);
      socket.off(ServerEvent.CONVERSATION_READ, onRead);
      socket.off(ServerEvent.TYPING, onTyping);
      socket.off(ServerEvent.PRESENCE, onPresence);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
      window.removeEventListener('blur', onVisibility);
      typingTimers.forEach(clearTimeout);
    };
  }, [meId, queryClient]);

  // Logged out (the user is gone from the cache): the socket goes too
  useEffect(() => {
    if (!meId) return;
    return () => disconnectSocket();
  }, [meId]);

  return null;
}
