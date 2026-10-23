'use client';

import type { AdminUser, Page, PostType } from '@instagram/shared';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useErrorText } from '@/features/auth/use-error-text';
import {
  banUser,
  deleteComment,
  deletePost,
  getActions,
  getComments,
  getPosts,
  getStats,
  getUsers,
  unbanUser,
  type UsersFilter,
} from './api';

export const adminKeys = {
  all: ['admin'] as const,
  stats: () => ['admin', 'stats'] as const,
  users: (filter: UsersFilter) => ['admin', 'users', filter] as const,
  posts: (type: PostType, q: string) => ['admin', 'posts', type, q] as const,
  comments: (q: string) => ['admin', 'comments', q] as const,
  actions: (q: string) => ['admin', 'actions', q] as const,
};

const nextCursor = (last: Page<unknown>) => last.nextCursor ?? undefined;

/** ADMIN-2: refreshed every 30 s, so "online now" stays roughly current */
export const useAdminStats = () =>
  useQuery({ queryKey: adminKeys.stats(), queryFn: getStats, refetchInterval: 30_000 });

export const useAdminUsers = (filter: UsersFilter) =>
  useInfiniteQuery({
    queryKey: adminKeys.users(filter),
    queryFn: ({ pageParam }) => getUsers(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: (previous) => previous,
  });

// placeholderData keeps the old results on screen while a new search loads
export const useAdminPosts = (type: PostType, q: string) =>
  useInfiniteQuery({
    queryKey: adminKeys.posts(type, q),
    queryFn: ({ pageParam }) => getPosts(type, q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === type ? previous : undefined,
  });

export const useAdminComments = (q: string) =>
  useInfiniteQuery({
    queryKey: adminKeys.comments(q),
    queryFn: ({ pageParam }) => getComments(q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: (previous) => previous,
  });

export const useAdminActions = (q: string) =>
  useInfiniteQuery({
    queryKey: adminKeys.actions(q),
    queryFn: ({ pageParam }) => getActions(q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: (previous) => previous,
  });

type Pages<T> = InfiniteData<Page<T>, string | undefined>;

/** Ban / unban: the row updates in every cached user list, then stats and the log refresh. */
function useUserAction<Vars>(action: (vars: Vars) => Promise<AdminUser>) {
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  return useMutation({
    mutationFn: action,
    onSuccess: (updated) => {
      queryClient.setQueriesData<Pages<AdminUser>>({ queryKey: ['admin', 'users'] }, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.map((u) => (u.id === updated.id ? updated : u)),
              })),
            }
          : data,
      );
      void queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'actions'] });
    },
    onError: (error) => toast.error(errorText(error)),
  });
}

export const useBanUser = () =>
  useUserAction(({ id, reason }: { id: string; reason: string }) => banUser(id, reason));

export const useUnbanUser = () => useUserAction(unbanUser);

/**
 * Deleting content: the item leaves every cached list of its kind at once (any search);
 * everything admin-related refetches after.
 */
function useRemove(remove: (id: string) => Promise<void>, listKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  return useMutation({
    mutationFn: remove,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueriesData<Pages<{ id: string }>>({ queryKey: listKey });
      queryClient.setQueriesData<Pages<{ id: string }>>({ queryKey: listKey }, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.filter((item) => item.id !== id),
              })),
            }
          : data,
      );
      return { previous };
    },
    onError: (error, _id, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data);
      toast.error(errorText(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export const useDeletePost = (type: PostType) => useRemove(deletePost, ['admin', 'posts', type]);

export const useDeleteComment = () => useRemove(deleteComment, ['admin', 'comments']);
