import type { UserPreview } from '@instagram/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  addToSearchHistory,
  clearSearchHistory,
  getHashtag,
  getHashtagPosts,
  getSearchHistory,
  removeFromSearchHistory,
  getTopReels,
  searchHashtags,
} from './api';

export const useHashtagSearch = (q: string) =>
  useQuery({
    queryKey: queryKeys.hashtagSearch(q),
    queryFn: () => searchHashtags(q),
    enabled: q.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

export const useSearchHistory = () =>
  useQuery({ queryKey: queryKeys.searchHistory(), queryFn: getSearchHistory });

// History changes show at once; the server keeps the same order (newest first, 20 max)
function useSetHistory() {
  const queryClient = useQueryClient();
  return (update: (users: UserPreview[]) => UserPreview[]) =>
    queryClient.setQueryData<UserPreview[]>(queryKeys.searchHistory(), (users) =>
      users ? update(users) : users,
    );
}

export const useAddToSearchHistory = () => {
  const setHistory = useSetHistory();
  return useMutation({
    mutationFn: (user: UserPreview) => addToSearchHistory(user.id),
    onMutate: (user) =>
      setHistory((users) => [user, ...users.filter((u) => u.id !== user.id)].slice(0, 20)),
  });
};

export const useRemoveFromSearchHistory = () => {
  const setHistory = useSetHistory();
  return useMutation({
    mutationFn: removeFromSearchHistory,
    onMutate: (userId) => setHistory((users) => users.filter((u) => u.id !== userId)),
  });
};

export const useClearSearchHistory = () => {
  const setHistory = useSetHistory();
  return useMutation({
    mutationFn: clearSearchHistory,
    onMutate: () => setHistory(() => []),
  });
};

export const useHashtag = (name: string) =>
  useQuery({ queryKey: queryKeys.hashtag(name), queryFn: () => getHashtag(name) });

export const useHashtagPosts = (name: string) =>
  useInfiniteQuery({
    queryKey: queryKeys.hashtagPosts(name),
    queryFn: ({ pageParam }) => getHashtagPosts(name, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useTopReels = () =>
  useInfiniteQuery({
    queryKey: queryKeys.topReels(),
    queryFn: ({ pageParam }) => getTopReels(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
