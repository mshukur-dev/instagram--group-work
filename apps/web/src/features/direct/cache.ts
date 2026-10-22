import type {
  Conversation,
  ConversationPreview,
  Message,
  MessagePreview,
  Page,
} from '@instagram/shared';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { ChatMessage } from './api';

// Socket events and optimistic sends all change the same two caches: the messages of one
// conversation (newest first) and the inbox list (latest activity first). Everything goes
// through these helpers so both stay in step (docs/spec/realtime.md §6).

type Thread = InfiniteData<Page<ChatMessage>>;
type Inbox = InfiniteData<Page<ConversationPreview>>;

export function toPreview(message: Message): MessagePreview {
  return {
    id: message.id,
    type: message.type,
    senderId: message.sender.id,
    senderUsername: message.sender.username,
    text: message.text,
    isDeleted: message.isDeleted,
    createdAt: message.createdAt,
  };
}

const sameMessage = (a: ChatMessage, b: ChatMessage) =>
  a.id === b.id || (Boolean(a.clientId) && a.clientId === b.clientId);

/** Adds a message to its conversation, or replaces the copy already there (optimistic or echo). */
export function upsertMessage(queryClient: QueryClient, message: ChatMessage) {
  queryClient.setQueryData<Thread>(queryKeys.messages(message.conversationId), (data) => {
    if (!data) return data;
    let found = false;
    const pages = data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => {
        if (!sameMessage(item, message)) return item;
        found = true;
        return { ...message, localKey: item.localKey ?? message.localKey };
      }),
    }));
    if (found) return { ...data, pages };
    const [first, ...rest] = pages;
    if (!first) return data;
    return { ...data, pages: [{ ...first, items: [message, ...first.items] }, ...rest] };
  });
}

export function patchMessage(
  queryClient: QueryClient,
  conversationId: string,
  match: (message: ChatMessage) => boolean,
  patch: (message: ChatMessage) => ChatMessage,
) {
  queryClient.setQueryData<Thread>(queryKeys.messages(conversationId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((m) => (match(m) ? patch(m) : m)),
          })),
        }
      : data,
  );
}

/** Changes one inbox row; `toTop` moves it to the top (new activity). Unknown rows reload the list. */
export function patchConversation(
  queryClient: QueryClient,
  conversationId: string,
  patch: (conversation: ConversationPreview) => ConversationPreview,
  toTop = false,
) {
  let found = false;
  queryClient.setQueryData<Inbox>(queryKeys.conversations(), (data) => {
    if (!data) return data;
    let moved: ConversationPreview | null = null;
    const pages = data.pages.map((page) => ({
      ...page,
      items: page.items.flatMap((item) => {
        if (item.id !== conversationId) return [item];
        found = true;
        const next = patch(item);
        if (toTop) {
          moved = next;
          return [];
        }
        return [next];
      }),
    }));
    if (moved && pages[0]) pages[0] = { ...pages[0], items: [moved, ...pages[0].items] };
    return { ...data, pages };
  });
  queryClient.setQueryData<Conversation>(queryKeys.conversation(conversationId), (data) =>
    data ? { ...data, ...patch(data) } : data,
  );
  if (!found) void queryClient.invalidateQueries({ queryKey: queryKeys.conversations() });
}

/** Puts a whole preview (from conversation:updated) into the inbox, replacing the old row. */
export function putConversation(queryClient: QueryClient, preview: ConversationPreview) {
  queryClient.setQueryData<Inbox>(queryKeys.conversations(), (data) => {
    if (!data) return data;
    const pages = data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== preview.id),
    }));
    if (pages[0]) pages[0] = { ...pages[0], items: [preview, ...pages[0].items] };
    return { ...data, pages };
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversation(preview.id) });
}

export function removeConversation(queryClient: QueryClient, conversationId: string) {
  queryClient.setQueryData<Inbox>(queryKeys.conversations(), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.id !== conversationId),
          })),
        }
      : data,
  );
  queryClient.removeQueries({ queryKey: queryKeys.conversation(conversationId) });
}
