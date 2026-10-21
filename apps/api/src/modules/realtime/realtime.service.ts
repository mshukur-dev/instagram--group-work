import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@instagram/shared';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
type EventName = keyof ServerToClientEvents;
type EventArgs<E extends EventName> = Parameters<ServerToClientEvents[E]>;

export const userRoom = (userId: string) => `user:${userId}`;

/**
 * The only way services talk to Socket.IO (docs/spec/realtime.md §5).
 * Also tracks which users are online and whether their tab is focused —
 * PushService uses this to decide between an in-app alert and a system push.
 *
 * The gateway calls attachServer / addSocket / removeSocket / setFocus.
 */
@Injectable()
export class RealtimeService {
  private server: AppServer | null = null;
  /** userId → socketId → focused */
  private readonly sockets = new Map<string, Map<string, boolean>>();

  attachServer(server: AppServer): void {
    this.server = server;
  }

  emitToUser<E extends EventName>(userId: string, event: E, ...args: EventArgs<E>): void {
    this.server?.to(userRoom(userId)).emit(event, ...args);
  }

  emitToUsers<E extends EventName>(userIds: string[], event: E, ...args: EventArgs<E>): void {
    if (userIds.length === 0) return;
    this.server?.to(userIds.map(userRoom)).emit(event, ...args);
  }

  /** @returns true if this is the user's first socket (they just came online) */
  addSocket(userId: string, socketId: string): boolean {
    const userSockets = this.sockets.get(userId) ?? new Map<string, boolean>();
    const cameOnline = userSockets.size === 0;
    userSockets.set(socketId, true);
    this.sockets.set(userId, userSockets);
    return cameOnline;
  }

  /** @returns true if this was the user's last socket (they just went offline) */
  removeSocket(userId: string, socketId: string): boolean {
    const userSockets = this.sockets.get(userId);
    if (!userSockets) return false;
    userSockets.delete(socketId);
    if (userSockets.size > 0) return false;
    this.sockets.delete(userId);
    return true;
  }

  setFocus(userId: string, socketId: string, focused: boolean): void {
    this.sockets.get(userId)?.set(socketId, focused);
  }

  isOnline(userId: string): boolean {
    return (this.sockets.get(userId)?.size ?? 0) > 0;
  }

  /** At least one tab of the user is open and focused. */
  isFocused(userId: string): boolean {
    for (const focused of this.sockets.get(userId)?.values() ?? []) {
      if (focused) return true;
    }
    return false;
  }
}
