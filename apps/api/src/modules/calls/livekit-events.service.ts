import { Injectable, Logger } from '@nestjs/common';
import type { WebhookEvent } from 'livekit-server-sdk';

type Handler = (event: WebhookEvent) => Promise<void>;

/**
 * One LiveKit webhook serves every feature: calls handle their own `call_*` rooms and hand
 * the rest here; a feature subscribes to its room-name prefix (live videos: `live_`).
 */
@Injectable()
export class LiveKitEventsService {
  private readonly logger = new Logger(LiveKitEventsService.name);
  private readonly handlers = new Map<string, Handler>();

  subscribe(prefix: string, handler: Handler): void {
    this.handlers.set(prefix, handler);
  }

  async dispatch(roomName: string, event: WebhookEvent): Promise<void> {
    for (const [prefix, handler] of this.handlers) {
      if (!roomName.startsWith(prefix)) continue;
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`LiveKit ${event.event} for ${roomName} failed: ${String(error)}`);
      }
    }
  }
}
