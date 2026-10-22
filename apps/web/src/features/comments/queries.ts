import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Me } from '@instagram/shared';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useErrorText } from '@/features/auth/use-error-text';
import { patchPost } from '@/features/posts/cache';
import { queryKeys } from '@/lib/query-keys';
import {
  addComment,
  deleteComment,
  getComments,
  getReplies,
  likeComment,
  unlikeComment,
  type CommentItem,
} from './api';
import {
  appendReply,
  patchComment,
  prependComment,
  removeComment,
  replaceComment,
  withThreadRollback,
} from './cache';

// ENGAGE-2: top-level comments of a post, newest first
export const useComments = (postId: string, enabled = true) =>
  useInfiniteQuery({
    enabled,
    queryKey: queryKeys.comments(postId),
    // A refetch would swap the keys of comments just posted and play their entrance again
    refetchOnWindowFocus: false,
    queryFn: ({ pageParam }) => getComments(postId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

// ENGAGE-3: replies of one comment, oldest first; loaded when the thread is opened
export const useReplies = (commentId: string, enabled: boolean) =>
  useInfiniteQuery({
    enabled,
    queryKey: queryKeys.replies(commentId),
    refetchOnWindowFocus: false,
    queryFn: ({ pageParam }) => getReplies(commentId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

type AddInput = {
  text: string;
  /** The comment being answered; an answer to a reply goes to the same thread */
  parentId?: string;
};

// A new comment shows up at once (with a temporary id) and is swapped for the server's copy
// when it arrives; if the server refuses, it disappears and the reason is shown.
export const useAddComment = (postId: string, me: Me | undefined) => {
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  return useMutation({
    mutationFn: ({ text, parentId }: AddInput) => addComment(postId, { text, parentId }),
    onMutate: ({ text, parentId }) => {
      if (!me) return { tempId: '', rollback: () => undefined };
      const tempId = `temp-${crypto.randomUUID()}`;
      const draft: CommentItem = {
        id: tempId,
        clientKey: tempId,
        postId,
        text,
        author: {
          id: me.id,
          username: me.username,
          fullName: me.fullName,
          avatarUrl: me.avatarUrl,
          hasActiveStory: me.hasActiveStory,
          hasUnseenStory: me.hasUnseenStory,
        },
        parentId: parentId ?? null,
        likesCount: 0,
        repliesCount: 0,
        isLiked: false,
        createdAt: new Date().toISOString(),
      };
      const rollback = withThreadRollback(queryClient, () => {
        if (parentId) {
          appendReply(queryClient, parentId, draft);
          patchComment(queryClient, parentId, (c) => ({ ...c, repliesCount: c.repliesCount + 1 }));
        } else {
          prependComment(queryClient, postId, draft);
        }
      });
      patchPost(queryClient, postId, (post) => ({
        ...post,
        commentsCount: post.commentsCount + 1,
      }));
      return { tempId, rollback };
    },
    onSuccess: (saved, { parentId }, context) => {
      replaceComment(queryClient, context.tempId, saved);
      // Replies that were still loading when this one was sent may have missed it
      if (parentId && !queryClient.getQueryData(queryKeys.replies(parentId))) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.replies(parentId) });
      }
    },
    onError: (error, _input, context) => {
      context?.rollback();
      patchPost(queryClient, postId, (post) => ({
        ...post,
        commentsCount: Math.max(0, post.commentsCount - 1),
      }));
      toast(errorText(error));
    },
  });
};

type DeleteInput = { comment: CommentItem };

// ENGAGE-5: deleting a comment removes its replies too; the post's counter follows
export const useDeleteComment = (postId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations('comments');
  return useMutation({
    mutationFn: ({ comment }: DeleteInput) => deleteComment(comment.id),
    onMutate: ({ comment }) => {
      const removed = 1 + (comment.parentId ? 0 : comment.repliesCount);
      const rollback = withThreadRollback(queryClient, () => {
        removeComment(queryClient, comment.id);
        if (comment.parentId) {
          patchComment(queryClient, comment.parentId, (c) => ({
            ...c,
            repliesCount: Math.max(0, c.repliesCount - 1),
          }));
        }
      });
      patchPost(queryClient, postId, (post) => ({
        ...post,
        commentsCount: Math.max(0, post.commentsCount - removed),
      }));
      return { rollback, removed };
    },
    onError: (_error, _input, context) => {
      context?.rollback();
      if (context) {
        patchPost(queryClient, postId, (post) => ({
          ...post,
          commentsCount: post.commentsCount + context.removed,
        }));
      }
      toast(t('deleteFailed'));
    },
  });
};

// ENGAGE-4: like of a comment, optimistic like the post's
export const useLikeComment = (commentId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations('comments');
  return useMutation({
    scope: { id: `comment-like-${commentId}` },
    mutationFn: (liked: boolean) => (liked ? likeComment(commentId) : unlikeComment(commentId)),
    onMutate: (liked) => {
      const rollback = withThreadRollback(queryClient, () =>
        patchComment(queryClient, commentId, (c) => ({
          ...c,
          isLiked: liked,
          likesCount: Math.max(0, c.likesCount + (c.isLiked === liked ? 0 : liked ? 1 : -1)),
        })),
      );
      return { rollback };
    },
    onError: (_error, _liked, context) => {
      context?.rollback();
      toast(t('likeFailed'));
    },
    onSuccess: ({ likesCount }) =>
      patchComment(queryClient, commentId, (c) => ({ ...c, likesCount })),
  });
};
