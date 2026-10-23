import type { Notification, Page, UserPreview } from '@instagram/shared';
import { api } from '@/lib/api';

export const getNotifications = (cursor?: string) =>
  api.get<Page<Notification>>('/notifications', { params: { cursor } }).then((r) => r.data);

export const markAllNotificationsRead = () =>
  api.post('/notifications/read-all').then(() => undefined);

export const getFollowRequests = (cursor?: string) =>
  api.get<Page<UserPreview>>('/follow-requests', { params: { cursor } }).then((r) => r.data);

export const acceptFollowRequest = (userId: string) =>
  api.post(`/follow-requests/${userId}/accept`).then(() => undefined);

export const declineFollowRequest = (userId: string) =>
  api.delete(`/follow-requests/${userId}`).then(() => undefined);
