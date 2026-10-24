import { Injectable, Logger } from '@nestjs/common';
import {
  AccessToken,
  DataPacket_Kind,
  RoomServiceClient,
  type WebhookEvent,
  WebhookReceiver,
} from 'livekit-server-sdk';
import { AppConfigService } from '../../config/app-config.service';

export type LiveKitUser = { id: string; username: string; avatarUrl: string | null };

/** Thin wrapper over livekit-server-sdk (docs/spec/calls.md §6–7). */
@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private readonly receiver: WebhookReceiver;
  private readonly rooms: RoomServiceClient;

  constructor(private readonly config: AppConfigService) {
    const key = config.get('LIVEKIT_API_KEY');
    const secret = config.get('LIVEKIT_API_SECRET');
    this.receiver = new WebhookReceiver(key, secret);
    // the server API uses http(s), the client connects over ws(s)
    this.rooms = new RoomServiceClient(this.url.replace(/^ws/, 'http'), key, secret);
  }

  /**
   * A data message from the server to everyone in a room (no sender participant). Used by the
   * demo audience of a live (topic 'live-demo', docs/spec/demo-bots.md).
   */
  async sendData(roomName: string, payload: unknown, topic: string): Promise<void> {
    const data = new TextEncoder().encode(JSON.stringify(payload));
    await this.rooms.sendData(roomName, data, DataPacket_Kind.RELIABLE, { topic });
  }

  /** URL the browser connects to. */
  get url(): string {
    return this.config.get('LIVEKIT_URL');
  }

  /**
   * Access token for one room only. Live viewers get `canPublish: false`: they watch and only
   * send data (chat, hearts).
   */
  createToken(
    user: LiveKitUser,
    roomName: string,
    { canPublish = true }: { canPublish?: boolean } = {},
  ): Promise<string> {
    const at = new AccessToken(
      this.config.get('LIVEKIT_API_KEY'),
      this.config.get('LIVEKIT_API_SECRET'),
      {
        identity: user.id,
        name: user.username,
        metadata: JSON.stringify({ avatarUrl: user.avatarUrl }),
        ttl: '2h',
      },
    );
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish,
      canPublishData: true,
      canSubscribe: true,
    });
    return at.toJwt();
  }

  /** Verifies the signature; null if the request is not from our LiveKit server. */
  async receiveWebhook(body: string, authHeader: string | undefined): Promise<WebhookEvent | null> {
    try {
      return await this.receiver.receive(body, authHeader);
    } catch {
      return null;
    }
  }

  /** Disconnects everyone still in the room. Fire-and-forget: the room may already be gone. */
  closeRoom(roomName: string): void {
    this.rooms.deleteRoom(roomName).catch((error: unknown) => {
      this.logger.debug(`deleteRoom(${roomName}) failed: ${String(error)}`);
    });
  }
}
