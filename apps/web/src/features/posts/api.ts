import type {
  CreatePostInput,
  MediaSignature,
  MediaSignatureInput,
  Page,
  Post,
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
