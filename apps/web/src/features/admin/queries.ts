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
  posts: (type: PostType) => ['admin', 'posts', type] as const,
  comments: () => ['admin', 'comments'] as const,
  actions: () => ['admin', 'actions'] as const,
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

export const useAdminPosts = (type: PostType) =>
  useInfiniteQuery({
    queryKey: adminKeys.posts(type),
    queryFn: ({ pageParam }) => getPosts(type, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });

export const useAdminComments = () =>
  useInfiniteQuery({
    queryKey: adminKeys.comments(),
    queryFn: ({ pageParam }) => getComments(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });

export const useAdminActions = () =>
  useInfiniteQuery({
    queryKey: adminKeys.actions(),
    queryFn: ({ pageParam }) => getActions(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
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
      void queryClient.invalidateQueries({ queryKey: adminKeys.actions() });
    },
    onError: (error) => toast.error(errorText(error)),
  });
}

export const useBanUser = () =>
  useUserAction(({ id, reason }: { id: string; reason: string }) => banUser(id, reason));

export const useUnbanUser = () => useUserAction(unbanUser);

/** Deleting content: the row leaves the list at once; everything admin-related refetches after. */
function useRemove(remove: (id: string) => Promise<void>, listKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  return useMutation({
    mutationFn: remove,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Pages<{ id: string }>>(listKey);
      queryClient.setQueryData<Pages<{ id: string }>>(listKey, (data) =>
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
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
      toast.error(errorText(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export const useDeletePost = (type: PostType) => useRemove(deletePost, adminKeys.posts(type));

export const useDeleteComment = () => useRemove(deleteComment, adminKeys.comments());
