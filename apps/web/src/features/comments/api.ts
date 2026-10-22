import type { Comment, CreateCommentInput, LikesCount, Page } from '@instagram/shared';
import { api } from '@/lib/api';

/** A comment in the cache. `clientKey` keeps the React key stable when a comment I just posted
 *  swaps its temporary id for the real one, so it does not animate in twice. */
export type CommentItem = Comment & { clientKey?: string };

export const getComments = (postId: string, cursor?: string) =>
  api
    .get<Page<CommentItem>>(`/posts/${postId}/comments`, { params: { cursor } })
    .then((r) => r.data);

export const getReplies = (commentId: string, cursor?: string) =>
  api
    .get<Page<CommentItem>>(`/comments/${commentId}/replies`, { params: { cursor } })
    .then((r) => r.data);

export const addComment = (postId: string, input: CreateCommentInput) =>
  api.post<Comment>(`/posts/${postId}/comments`, input).then((r) => r.data);

export const deleteComment = (id: string) => api.delete(`/comments/${id}`).then(() => undefined);

export const likeComment = (id: string) =>
  api.post<LikesCount>(`/comments/${id}/like`).then((r) => r.data);

export const unlikeComment = (id: string) =>
  api.delete<LikesCount>(`/comments/${id}/like`).then((r) => r.data);
