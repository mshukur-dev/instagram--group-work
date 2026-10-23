import type { Hashtag, Page, Post, UserPreview } from '@instagram/shared';
import { api } from '@/lib/api';

export const searchHashtags = (q: string) =>
  api.get<Hashtag[]>('/search/hashtags', { params: { q, limit: 20 } }).then((r) => r.data);

export const getSearchHistory = () =>
  api.get<UserPreview[]>('/search/history').then((r) => r.data);

export const addToSearchHistory = (userId: string) =>
  api.post('/search/history', { userId }).then(() => undefined);

export const removeFromSearchHistory = (userId: string) =>
  api.delete(`/search/history/${userId}`).then(() => undefined);

export const clearSearchHistory = () => api.delete('/search/history').then(() => undefined);

export const getHashtag = (name: string) =>
  api.get<Hashtag>(`/hashtags/${encodeURIComponent(name)}`).then((r) => r.data);

export const getHashtagPosts = (name: string, cursor?: string) =>
  api
    .get<Page<Post>>(`/hashtags/${encodeURIComponent(name)}/posts`, { params: { cursor } })
    .then((r) => r.data);
