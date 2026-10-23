import type {
  Conversation,
  Me,
  SendMessageInput,
  UpdateConversationInput,
} from '@instagram/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import {
  addMembers,
  createGroup,
  deleteConversation,
  deleteMessage,
  getConversation,
  getConversations,
  getMessages,
  markRead,
  openDirect,
  reactToMessage,
  removeMember,
  searchUsers,
  sendMessage,
  updateConversation,
  type ChatMessage,
} from './api';
import {
  patchConversation,
  patchMessage,
  putConversation,
  removeConversation,
  toPreview,
  upsertMessage,
} from './cache';

// DM-1: the inbox, latest activity first
export const useConversations = () =>
  useInfiniteQuery({
    queryKey: queryKeys.conversations(),
    queryFn: ({ pageParam }) => getConversations(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useConversation = (id: string) =>
  useQuery({ queryKey: queryKeys.conversation(id), queryFn: () => getConversation(id) });

// DM-2: messages of one conversation, newest first; older pages load when scrolled up.
// New ones arrive through the socket, so the list is never refetched behind the user's back.
export const useMessages = (id: string) =>
  useInfiniteQuery({
    queryKey: queryKeys.messages(id),
    queryFn: ({ pageParam }) =>
      getMessages(id, pageParam) as Promise<{
        items: ChatMessage[];
        nextCursor: string | null;
      }>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

type SendInput = Omit<SendMessageInput, 'clientId'> & {
  /** Set when a failed message is sent again: it keeps its place and key */
  retryOf?: ChatMessage;
};

// DM-3: sent over REST (docs/spec/realtime.md). The message shows up at once with a clock,
// turns into the saved one when the server answers, or into a red "tap to retry" if it fails.
export const useSendMessage = (conversationId: string, me: Me | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ retryOf: _retry, ...input }: SendInput & { clientId: string }) =>
      sendMessage(conversationId, input),
    onMutate: (input) => {
      if (!me) return;
      const draft: ChatMessage = input.retryOf
        ? { ...input.retryOf, status: 'sending' }
        : {
            id: `local-${input.clientId}`,
            clientId: input.clientId,
            localKey: input.clientId,
            conversationId,
            sender: {
              id: me.id,
              username: me.username,
              fullName: me.fullName,
              avatarUrl: me.avatarUrl,
              hasActiveStory: me.hasActiveStory,
              hasUnseenStory: me.hasUnseenStory,
            },
            type: input.type,
            text: input.text ?? null,
            mediaUrl: input.mediaUrl ?? null,
            mediaType: input.mediaType ?? null,
            post: null,
            story: null,
            call: null,
            replyTo: null,
            reactions: [],
            systemData: null,
            isDeleted: false,
            createdAt: new Date().toISOString(),
            status: 'sending',
          };
      upsertMessage(queryClient, draft);
      patchConversation(
        queryClient,
        conversationId,
        (c) => ({ ...c, lastMessage: toPreview(draft), lastMessageAt: draft.createdAt }),
        true,
      );
    },
    onSuccess: (saved) => upsertMessage(queryClient, { ...saved, status: undefined }),
    onError: (_error, input) =>
      patchMessage(
        queryClient,
        conversationId,
        (m) => m.clientId === input.clientId,
        (m) => ({ ...m, status: 'failed' }),
      ),
  });
};

/** DM-7: my lastReadAt moves on; the unread counters of the inbox and the menu follow. */
export const useMarkRead = (conversationId: string, myId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markRead(conversationId),
    onMutate: () => {
      // My own read mark moves at once, so the same messages are not marked twice
      const now = new Date().toISOString();
      queryClient.setQueryData<Conversation>(queryKeys.conversation(conversationId), (c) =>
        c
          ? { ...c, members: c.members.map((m) => (m.id === myId ? { ...m, lastReadAt: now } : m)) }
          : c,
      );
      let wasUnread = false;
      patchConversation(queryClient, conversationId, (c) => {
        wasUnread = c.unreadCount > 0;
        return { ...c, unreadCount: 0 };
      });
      if (wasUnread) {
        queryClient.setQueryData<Me>(queryKeys.me(), (me) =>
          me
            ? { ...me, unreadConversationsCount: Math.max(0, me.unreadConversationsCount - 1) }
            : me,
        );
      }
    },
  });
};

export const useDeleteMessage = (conversationId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations('direct');
  return useMutation({
    mutationFn: (message: ChatMessage) => deleteMessage(message.id),
    onMutate: (message) =>
      patchMessage(
        queryClient,
        conversationId,
        (m) => m.id === message.id,
        (m) => ({ ...m, isDeleted: true, text: null, reactions: [] }),
      ),
    onError: (_error, message) => {
      upsertMessage(queryClient, message);
      toast.error(t('unsendFailed'));
    },
  });
};

// DM-8: one reaction per person; the same emoji again takes it back
export const useReact = (conversationId: string, myId: string | undefined) => {
  const queryClient = useQueryClient();
  const t = useTranslations('direct');
  return useMutation({
    mutationFn: ({ message, emoji }: { message: ChatMessage; emoji: string | null }) =>
      reactToMessage(message.id, emoji),
    onMutate: ({ message, emoji }) => {
      if (!myId) return;
      patchMessage(
        queryClient,
        conversationId,
        (m) => m.id === message.id,
        (m) => ({
          ...m,
          reactions: [
            ...m.reactions.filter((r) => r.userId !== myId),
            ...(emoji ? [{ emoji, userId: myId }] : []),
          ],
        }),
      );
    },
    onError: (_error, { message }) => {
      upsertMessage(queryClient, message);
      toast.error(t('reactFailed'));
    },
  });
};

export const useOpenDirect = () => useMutation({ mutationFn: openDirect });
export const useCreateGroup = () => useMutation({ mutationFn: createGroup });

export const useUserSearch = (q: string) =>
  useQuery({
    queryKey: queryKeys.userSearch(q),
    queryFn: () => searchUsers(q),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

// DM-4: group settings. The server also sends conversation:updated and a system message to
// everyone, so these only refresh what this tab shows right away.
export const useUpdateGroup = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateConversationInput) => updateConversation(id, input),
    onSuccess: (conversation) => {
      queryClient.setQueryData(queryKeys.conversation(id), conversation);
      putConversation(queryClient, conversation);
    },
  });
};

export const useAddMembers = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => addMembers(id, userIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversation(id) }),
  });
};

export const useRemoveMember = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeMember(id, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.conversation(id) }),
  });
};

/** "Delete chat" (a group: leave it too): the chat disappears from the inbox at once */
export const useDeleteChat = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteConversation(id),
    onSuccess: () => {
      removeConversation(queryClient, id);
      queryClient.removeQueries({ queryKey: queryKeys.conversation(id) });
      queryClient.removeQueries({ queryKey: queryKeys.messages(id) });
    },
  });
};
