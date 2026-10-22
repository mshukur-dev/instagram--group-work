import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { createStory, getStoriesFeed, getUserStories, viewStory } from './api';

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

export const useViewStory = () => {
  const refreshRings = useRefreshRings();
  return useMutation({ mutationFn: viewStory, onSuccess: refreshRings });
};

export const useCreateStory = () => {
  const refreshRings = useRefreshRings();
  return useMutation({ mutationFn: createStory, onSuccess: refreshRings });
};
