import type {
  CreatePostInput,
  MediaSignature,
  MediaSignatureInput,
  Page,
  Post,
  UpdatePostInput,
  UserListItem,
} from '@instagram/shared';
import { api } from '@/lib/api';

export const getFeed = (cursor?: string) =>
  api.get<Page<Post>>('/feed', { params: { cursor } }).then((r) => r.data);

export const likePost = (id: string) =>
  api.post<{ likesCount: number }>(`/posts/${id}/like`).then((r) => r.data);

export const unlikePost = (id: string) =>
  api.delete<{ likesCount: number }>(`/posts/${id}/like`).then((r) => r.data);

export const savePost = (id: string) => api.post(`/posts/${id}/save`).then(() => undefined);

export const unsavePost = (id: string) => api.delete(`/posts/${id}/save`).then(() => undefined);

export const getMediaSignature = (input: MediaSignatureInput) =>
  api.post<MediaSignature>('/media/signature', input).then((r) => r.data);

export const createPost = (input: CreatePostInput) =>
  api.post<Post>('/posts', input).then((r) => r.data);

export const getPost = (id: string) => api.get<Post>(`/posts/${id}`).then((r) => r.data);

export const updatePost = (id: string, input: UpdatePostInput) =>
  api.patch<Post>(`/posts/${id}`, input).then((r) => r.data);

export const deletePost = (id: string) => api.delete(`/posts/${id}`).then(() => undefined);

/** People who liked a post, newest first; `q` filters by username and name. */
export const getLikers = (postId: string, q: string, cursor?: string) =>
  api
    .get<Page<UserListItem>>(`/posts/${postId}/likes`, { params: { cursor, q: q || undefined } })
    .then((r) => r.data);
