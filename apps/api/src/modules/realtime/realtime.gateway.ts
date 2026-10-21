import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { SkipThrottle } from '@nestjs/throttler';
import type { Server, Socket } from 'socket.io';
import {
  ClientEvent,
  type ClientToServerEvents,
  type PresenceState,
  type ServerToClientEvents,
  presenceFocusSchema,
  presenceSubscribeSchema,
  typingEventSchema,
} from '@instagram/shared';
import { Public } from '../../common/decorators/public.decorator';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TokensService } from '../auth/tokens.service';
import { PresenceService } from './presence.service';
import { RealtimeService, userRoom } from './realtime.service';

type SocketData = { userId?: string };
type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/** Set from config in the constructor, which runs before the Socket.IO server is created. */
let allowedOrigin = 'http://localhost:3000';

/**
 * Socket.IO entry point (docs/spec/realtime.md). The client connects with
 * `auth: { token }` from GET /auth/socket-token; every tab joins room user:<id>.
 * Messages are sent over REST — sockets only deliver events.
 */
@Public() // auth is the handshake token, not the HTTP cookie guard
@SkipThrottle()
@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, !origin || origin === allowedOrigin),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    config: AppConfigService,
    private readonly tokens: TokensService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly presence: PresenceService,
  ) {
    allowedOrigin = config.get('WEB_URL');
  }

  afterInit(server: AppServer): void {
    this.realtime.attachServer(server);
    // reject the handshake without a valid token: the client gets connect_error "UNAUTHORIZED"
    server.use((socket, next) => {
      this.authenticate(socket)
        .then((userId) => {
          if (!userId) return next(new Error('UNAUTHORIZED'));
          socket.data.userId = userId;
          next();
        })
        .catch(() => next(new Error('UNAUTHORIZED')));
    });
  }

  async handleConnection(socket: AppSocket): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) {
      socket.disconnect(true);
      return;
    }
    await socket.join(userRoom(userId));
    await this.presence.connected(userId, socket.id).catch((e: unknown) => this.logger.error(e));
  }

  async handleDisconnect(socket: AppSocket): Promise<void> {
    const userId = socket.data.userId;
    if (!userId) return;
    await this.presence.disconnected(userId, socket.id).catch((e: unknown) => this.logger.error(e));
  }

  @SubscribeMessage(ClientEvent.TYPING)
  async onTyping(
    @ConnectedSocket() socket: AppSocket,
    @MessageBody() body: unknown,
  ): Promise<void> {
    const userId = socket.data.userId;
    const data = typingEventSchema.safeParse(body);
    if (!userId || !data.success) return;
    await this.presence.typing(userId, data.data.conversationId, data.data.isTyping);
  }

  /** The return value is the ack: current states of the requested users. */
  @SubscribeMessage(ClientEvent.PRESENCE_SUBSCRIBE)
  async onPresenceSubscribe(
    @ConnectedSocket() socket: AppSocket,
    @MessageBody() body: unknown,
  ): Promise<PresenceState[]> {
    const userId = socket.data.userId;
    const data = presenceSubscribeSchema.safeParse(body);
    if (!userId || !data.success) return [];
    return this.presence.states(userId, data.data.userIds);
  }

  @SubscribeMessage(ClientEvent.PRESENCE_FOCUS)
  onPresenceFocus(@ConnectedSocket() socket: AppSocket, @MessageBody() body: unknown): void {
    const userId = socket.data.userId;
    const data = presenceFocusSchema.safeParse(body);
    if (!userId || !data.success) return;
    this.realtime.setFocus(userId, socket.id, data.data.focused);
  }

  private async authenticate(socket: AppSocket): Promise<string | null> {
    const auth: unknown = socket.handshake.auth;
    const token =
      auth && typeof auth === 'object' && 'token' in auth && typeof auth.token === 'string'
        ? auth.token
        : null;
    if (!token) return null;
    const payload = await this.tokens.verifySocket(token);
    if (!payload) return null;
    const exists = await this.prisma.user.count({ where: { id: payload.sub } });
    return exists > 0 ? payload.sub : null;
  }
}
