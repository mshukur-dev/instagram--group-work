import type { CallJoin, CallType } from '@instagram/shared';
import { api } from '@/lib/api';

export const startCall = (conversationId: string, type: CallType) =>
  api.post<CallJoin>(`/conversations/${conversationId}/calls`, { type }).then((r) => r.data);

/** Accept a 1:1 call, or join (rejoin) a group call */
export const joinCall = (callId: string) =>
  api.post<CallJoin>(`/calls/${callId}/join`).then((r) => r.data);

export const declineCall = (callId: string) =>
  api.post(`/calls/${callId}/decline`).then(() => undefined);

export const leaveCall = (callId: string) =>
  api.post(`/calls/${callId}/leave`).then(() => undefined);

/** Hanging up while the tab closes: the request must outlive the page */
export const leaveCallOnUnload = (callId: string) =>
  fetch(`/api/calls/${callId}/leave`, { method: 'POST', credentials: 'include', keepalive: true });
