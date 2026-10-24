import { Injectable } from '@nestjs/common';
import { PresenceService } from '../realtime/presence.service';

// A demo account counts as online through this made-up connection id
const SOCKET_ID = 'demo-bot';

/**
 * Green dots for demo accounts (docs/spec/demo-bots.md): one that just did something, or that a
 * real person online has a chat with, shows as "Active now" for a few minutes, then as
 * "Active N min ago". It goes through PresenceService, so chat partners see the change live.
 */
@Injectable()
export class DemoPresenceService {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly presence: PresenceService) {}

  isOnline(botId: string): boolean {
    return this.timers.has(botId);
  }

  /** Online now, until `minutes` pass without anything new */
  markOnline(botId: string, minutes = 4 + Math.random() * 4): void {
    const timer = this.timers.get(botId);
    if (timer) clearTimeout(timer);
    else void this.presence.connected(botId, SOCKET_ID).catch(() => undefined);
    this.timers.set(
      botId,
      setTimeout(() => {
        this.timers.delete(botId);
        void this.presence.disconnected(botId, SOCKET_ID).catch(() => undefined);
      }, minutes * 60_000),
    );
  }
}
