import type {
  Conversation,
  ConversationPreview,
  CreateGroupInput,
  Message,
  Page,
  SendMessageInput,
  UpdateConversationInput,
  UserPreview,
} from '@instagram/shared';
import { api } from '@/lib/api';

/** A message as the UI keeps it: the server's, plus the state of one still being sent. */
export type ChatMessage = Message & {
  /** Only on messages written in this tab: sending → (saved) or failed */
  status?: 'sending' | 'failed';
  /** Stable React key: the clientId of an optimistic message, kept after it is saved */
  localKey?: string;
};

export const getConversations = (cursor?: string) =>
  api.get<Page<ConversationPreview>>('/conversations', { params: { cursor } }).then((r) => r.data);

export const getConversation = (id: string) =>
  api.get<Conversation>(`/conversations/${id}`).then((r) => r.data);

export const getMessages = (id: string, cursor?: string) =>
  api
    .get<Page<Message>>(`/conversations/${id}/messages`, { params: { cursor } })
    .then((r) => r.data);

export const sendMessage = (conversationId: string, input: SendMessageInput) =>
  api.post<Message>(`/conversations/${conversationId}/messages`, input).then((r) => r.data);

export const openDirect = (userId: string) =>
  api.post<Conversation>(`/conversations/direct/${userId}`).then((r) => r.data);

export const createGroup = (input: CreateGroupInput) =>
  api.post<Conversation>('/conversations/group', input).then((r) => r.data);

export const updateConversation = (id: string, input: UpdateConversationInput) =>
  api.patch<Conversation>(`/conversations/${id}`, input).then((r) => r.data);

export const addMembers = (id: string, userIds: string[]) =>
  api.post(`/conversations/${id}/members`, { userIds }).then(() => undefined);

/** An admin removes someone; with my own id it is "leave the group" */
export const removeMember = (id: string, userId: string) =>
  api.delete(`/conversations/${id}/members/${userId}`).then(() => undefined);

/** "Delete chat" for me only; for a group it also means leaving it */
export const deleteConversation = (id: string) =>
  api.delete(`/conversations/${id}`).then(() => undefined);

export const markRead = (conversationId: string) =>
  api.post(`/conversations/${conversationId}/read`).then(() => undefined);

export const deleteMessage = (messageId: string) =>
  api.delete(`/messages/${messageId}`).then(() => undefined);

export const reactToMessage = (messageId: string, emoji: string | null) =>
  (emoji
    ? api.put(`/messages/${messageId}/reaction`, { emoji })
    : api.delete(`/messages/${messageId}/reaction`)
  ).then(() => undefined);

export const searchUsers = (q: string) =>
  api.get<UserPreview[]>('/search/users', { params: { q, limit: 20 } }).then((r) => r.data);
