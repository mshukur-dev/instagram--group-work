import type { ClientToServerEvents, ServerToClientEvents } from '@instagram/shared';
import { io, type Socket } from 'socket.io-client';
import { api } from './api';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

// One Socket.IO connection per tab (docs/spec/realtime.md §1). The socket talks to the API
// directly, so the httpOnly cookies of the site never reach it: every (re)connect first asks the
// API for a one-minute token and hands it over in the handshake.
export function connectSocket(): AppSocket {
  if (socket) return socket;
  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000', {
    withCredentials: true,
    transports: ['websocket'],
    auth: (send) => {
      api
        .get<{ token: string }>('/auth/socket-token')
        .then((r) => send({ token: r.data.token }))
        .catch(() => send({}));
    },
  });
  return socket;
}

export function getSocket(): AppSocket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
