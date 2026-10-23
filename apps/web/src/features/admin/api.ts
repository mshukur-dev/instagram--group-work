import type {
  AdminAction,
  AdminComment,
  AdminPost,
  AdminStats,
  AdminUser,
  Page,
  PostType,
} from '@instagram/shared';
import { api } from '@/lib/api';

export type UsersFilter = {
  q: string;
  sort: 'newest' | 'oldest';
  /** undefined: everyone */
  banned?: boolean;
};

export const getStats = () => api.get<AdminStats>('/admin/stats').then((r) => r.data);

export const getUsers = (filter: UsersFilter, cursor?: string) =>
  api
    .get<Page<AdminUser>>('/admin/users', {
      params: {
        q: filter.q || undefined,
        sort: filter.sort,
        banned: filter.banned === undefined ? undefined : String(filter.banned),
        cursor,
      },
    })
    .then((r) => r.data);

export const banUser = (id: string, reason: string) =>
  api.post<AdminUser>(`/admin/users/${id}/ban`, { reason }).then((r) => r.data);

export const unbanUser = (id: string) =>
  api.delete<AdminUser>(`/admin/users/${id}/ban`).then((r) => r.data);

export const getPosts = (type: PostType, cursor?: string) =>
  api.get<Page<AdminPost>>('/admin/posts', { params: { type, cursor } }).then((r) => r.data);

export const deletePost = (id: string) => api.delete(`/admin/posts/${id}`).then(() => undefined);

export const getComments = (cursor?: string) =>
  api.get<Page<AdminComment>>('/admin/comments', { params: { cursor } }).then((r) => r.data);

export const deleteComment = (id: string) =>
  api.delete(`/admin/comments/${id}`).then(() => undefined);

export const getActions = (cursor?: string) =>
  api.get<Page<AdminAction>>('/admin/actions', { params: { cursor } }).then((r) => r.data);
