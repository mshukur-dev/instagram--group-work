import type { LiveJoin, LiveStream } from '@instagram/shared';
import { api } from '@/lib/api';

/** Running lives of people I follow (and mine), for the LIVE rings */
export const getLives = () => api.get<LiveStream[]>('/lives').then((r) => r.data);

export const getLiveOf = (username: string) =>
  api.get<LiveStream>(`/users/${username}/live`).then((r) => r.data);

/** Go live, or rejoin my running live */
export const startLive = () => api.post<LiveJoin>('/lives').then((r) => r.data);

export const joinLive = (id: string) => api.post<LiveJoin>(`/lives/${id}/join`).then((r) => r.data);

export const endLive = (id: string) => api.post(`/lives/${id}/end`).then(() => undefined);
