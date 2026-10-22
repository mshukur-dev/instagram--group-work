import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { getFeed, likePost, savePost, unlikePost, unsavePost } from './api';
import { patchPost, patchPostWithRollback } from './cache';
import { publishPost } from './create/publish';

// Like and save update the UI at once (docs/spec/frontend.md: optimistic updates) and roll back
// on error. Requests for one post run one after another (`scope`), so quick taps cannot overtake
// each other.
export const useLikePost = (postId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: `like-${postId}` },
    mutationFn: (liked: boolean) => (liked ? likePost(postId) : unlikePost(postId)),
    onMutate: async (liked) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feed() });
      const rollback = patchPostWithRollback(queryClient, postId, (post) => ({
        ...post,
        isLiked: liked,
        likesCount: Math.max(0, post.likesCount + (post.isLiked === liked ? 0 : liked ? 1 : -1)),
      }));
      return { rollback };
    },
    onError: (_error, _liked, context) => context?.rollback(),
    // The server count is the truth (other people may have liked in the meantime)
    onSuccess: ({ likesCount }) =>
      patchPost(queryClient, postId, (post) => ({ ...post, likesCount })),
  });
};

export const useSavePost = (postId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: `save-${postId}` },
    mutationFn: (saved: boolean) => (saved ? savePost(postId) : unsavePost(postId)),
    onMutate: async (saved) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.feed() });
      const rollback = patchPostWithRollback(queryClient, postId, (post) => ({
        ...post,
        isSaved: saved,
      }));
      return { rollback };
    },
    onError: (_error, _saved, context) => context?.rollback(),
  });
};

export const useCreatePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: publishPost,
    onSuccess: () => {
      // The new post must appear in the feed and on the profile, the counter changes
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

export const useFeed = () =>
  useInfiniteQuery({
    queryKey: queryKeys.feed(),
    queryFn: ({ pageParam }) => getFeed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
