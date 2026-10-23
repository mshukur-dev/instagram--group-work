import type { Me, Page, UserPreview } from '@instagram/shared';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  acceptFollowRequest,
  declineFollowRequest,
  getFollowRequests,
  getNotifications,
  markAllNotificationsRead,
} from './api';

export const useNotifications = () =>
  useInfiniteQuery({
    queryKey: queryKeys.notifications(),
    queryFn: ({ pageParam }) => getNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useFollowRequests = () =>
  useInfiniteQuery({
    queryKey: queryKeys.followRequests(),
    queryFn: ({ pageParam }) => getFollowRequests(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

// Opening the notifications clears the red dot at once
export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: () =>
      queryClient.setQueryData<Me>(queryKeys.me(), (me) =>
        me ? { ...me, unreadNotificationsCount: 0 } : me,
      ),
  });
};

// Confirm or Delete: the person leaves the requests list and the counter at once
export const useAnswerFollowRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, accept }: { userId: string; accept: boolean }) =>
      accept ? acceptFollowRequest(userId) : declineFollowRequest(userId),
    onMutate: ({ userId }) => {
      queryClient.setQueryData<InfiniteData<Page<UserPreview>>>(
        queryKeys.followRequests(),
        (data) =>
          data
            ? {
                ...data,
                pages: data.pages.map((page) => ({
                  ...page,
                  items: page.items.filter((user) => user.id !== userId),
                })),
              }
            : data,
      );
      queryClient.setQueryData<Me>(queryKeys.me(), (me) =>
        me
          ? { ...me, pendingFollowRequestsCount: Math.max(0, me.pendingFollowRequestsCount - 1) }
          : me,
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      // My followers counter and list change after Confirm
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    },
  });
};
