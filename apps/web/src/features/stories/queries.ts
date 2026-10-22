import type { Story } from '@instagram/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { createStory, getStoriesFeed, getStoryViewers, getUserStories, viewStory } from './api';

export const useStoriesFeed = () =>
  useQuery({ queryKey: queryKeys.storiesFeed(), queryFn: getStoriesFeed });

export const useUserStories = (username: string) =>
  useQuery({ queryKey: queryKeys.userStories(username), queryFn: () => getUserStories(username) });

// After a story is seen or added, the rings (tray, profile, post headers) must be fetched again
function useRefreshRings() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.storiesFeed() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.feed() });
  };
}

// A seen story only changes the tray right away; profile, post headers and feed rings are
// refreshed once the viewer closes (useRefreshRingsOnClose), not after every single story
export const useViewStory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: viewStory,
    onSuccess: (_data, id) => {
      queryClient.setQueriesData<Story[]>({ queryKey: ['stories', 'user'] }, (stories) =>
        stories?.map((story) => (story.id === id ? { ...story, isSeen: true } : story)),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.storiesFeed() });
    },
  });
};

export const useRefreshRingsOnClose = () => useRefreshRings();

export const useStoryViewers = (storyId: string, enabled: boolean) =>
  useInfiniteQuery({
    enabled,
    queryKey: queryKeys.storyViewers(storyId),
    queryFn: ({ pageParam }) => getStoryViewers(storyId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useCreateStory = () => {
  const refreshRings = useRefreshRings();
  return useMutation({ mutationFn: createStory, onSuccess: refreshRings });
};
