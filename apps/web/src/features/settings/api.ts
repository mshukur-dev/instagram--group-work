import type {
  ChangePasswordInput,
  CreateHighlightInput,
  Highlight,
  Page,
  SessionInfo,
  Settings,
  Story,
  UpdateNotificationSettingsInput,
  UpdateSettingsInput,
  UserPreview,
} from '@instagram/shared';
import { api } from '@/lib/api';

export const getSettings = () => api.get<Settings>('/settings').then((r) => r.data);

export const updateSettings = (input: UpdateSettingsInput) =>
  api.patch<Settings>('/settings', input).then((r) => r.data);

export const updateNotificationSettings = (input: UpdateNotificationSettingsInput) =>
  api.patch<Settings>('/settings/notifications', input).then((r) => r.data);

export const getSessions = () => api.get<SessionInfo[]>('/settings/sessions').then((r) => r.data);

export const logoutSession = (id: string) =>
  api.delete(`/settings/sessions/${id}`).then(() => undefined);

export const logoutOtherSessions = () => api.delete('/settings/sessions').then(() => undefined);

export const changePassword = (input: ChangePasswordInput) =>
  api.patch('/users/me/password', input).then(() => undefined);

export const getBlocked = () => api.get<UserPreview[]>('/users/me/blocked').then((r) => r.data);

export const unblockUser = (username: string) =>
  api.delete(`/users/${username}/block`).then(() => undefined);

export const getStoryArchive = (cursor?: string) =>
  api.get<Page<Story>>('/stories/archive', { params: { cursor } }).then((r) => r.data);

export const createHighlight = (input: CreateHighlightInput) =>
  api.post<Highlight>('/highlights', input).then((r) => r.data);
