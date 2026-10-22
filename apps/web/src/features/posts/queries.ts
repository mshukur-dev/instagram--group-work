import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ErrorCode } from '@instagram/shared';
import { getErrorCode } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  deletePost,
  getFeed,
  getPost,
  likePost,
  savePost,
  unlikePost,
  unsavePost,
  updatePost,
  getLikers,
} from './api';
import { findCachedPost, patchPost, patchPostWithRollback, removePost } from './cache';
import { publishPost } from './create/publish';

// Like and save update the UI at once (docs/spec/frontend.md: optimistic updates) and roll back
// on error. Requests for one post run one after another (`scope`), so quick taps cannot overtake
// each other.
export const useLikePost = (postId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations('post');
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
    onError: (_error, _liked, context) => {
      context?.rollback();
      toast(t('likeFailed'));
    },
    // The server count is the truth (other people may have liked in the meantime)
    onSuccess: ({ likesCount }) =>
      patchPost(queryClient, postId, (post) => ({ ...post, likesCount })),
  });
};

export const useSavePost = (postId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations('post');
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
    onError: (_error, _saved, context) => {
      context?.rollback();
      toast(t('saveFailed'));
    },
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

// One post for the modal / post page. The feed or grid it was opened from seeds the cache, so
// the modal opens with the photo already in place and the server only refreshes the numbers.
export const usePost = (postId: string) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.post(postId),
    queryFn: () => getPost(postId),
    initialData: () => findCachedPost(queryClient, postId),
    // A missing or private post stays that way, no point in asking again
    retry: (failureCount, error) => {
      const code = getErrorCode(error);
      const final = code === ErrorCode.POST_NOT_FOUND || code === ErrorCode.PRIVATE_ACCOUNT;
      return !final && failureCount < 2;
    },
  });
};

export const useUpdatePost = (postId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations('post');
  return useMutation({
    scope: { id: `update-${postId}` },
    mutationFn: (input: Parameters<typeof updatePost>[1]) => updatePost(postId, input),
    onMutate: (input) => {
      const rollback = patchPostWithRollback(queryClient, postId, (post) => ({
        ...post,
        ...(input.caption !== undefined && { caption: input.caption || null }),
        ...(input.commentsDisabled !== undefined && { commentsDisabled: input.commentsDisabled }),
      }));
      return { rollback };
    },
    onError: (_error, _input, context) => {
      context?.rollback();
      toast(t('updateFailed'));
    },
    onSuccess: (saved) => patchPost(queryClient, postId, () => saved),
  });
};

export const useDeletePost = (postId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations('post');
  return useMutation({
    mutationFn: () => deletePost(postId),
    onSuccess: () => {
      removePost(queryClient, postId);
      // The profile counter and the grids of other tabs change too
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast(t('deleted'));
    },
    onError: () => toast(t('deleteFailed')),
  });
};

// Who liked a post (the "Liked by … and N others" list), with search
export const likersOptions = (postId: string, q: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.likers(postId, q),
    queryFn: ({ pageParam }) => getLikers(postId, q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
