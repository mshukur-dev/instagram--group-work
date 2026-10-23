import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { getReels, viewReel } from './api';

export const useReels = () =>
  useInfiniteQuery({
    queryKey: queryKeys.reels(),
    queryFn: ({ pageParam }) => getReels(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useViewReel = () => useMutation({ mutationFn: viewReel });
