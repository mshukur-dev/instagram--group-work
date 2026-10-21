import { Injectable, Logger } from '@nestjs/common';
import type { Language, PushPayload, PushSubscriptionInput } from '@instagram/shared';
import { sendNotification } from 'web-push';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

/** Matches the toggles in NotificationSettings. */
export type PushCategory = 'likes' | 'comments' | 'follows' | 'messages' | 'calls';

/** How long the push service keeps an undelivered push (seconds). Calls are useless later. */
const TTL_DEFAULT = 24 * 60 * 60;
const TTL_CALL = 30;

/**
 * Web Push (docs/spec/push.md). Contract used by other modules — the signature of notify is fixed.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Sends a web push to all browsers of the user, unless:
   * the user has a focused tab, push is disabled/paused, or the category is turned off.
   * `build` receives the recipient's language and returns the localized payload.
   * Fire-and-forget: never throws, don't await in request handlers.
   */
  notify(userId: string, category: PushCategory, build: (language: Language) => PushPayload): void {
    if (!this.config.isPushEnabled) return;
    if (this.realtime.isFocused(userId)) return;
    this.send(userId, category, build).catch((error: unknown) => {
      this.logger.error(`Push to ${userId} failed: ${String(error)}`);
    });
  }

  getPublicKey(): string | undefined {
    return this.config.isPushEnabled ? this.config.get('VAPID_PUBLIC_KEY') : undefined;
  }

  /** One row per browser: the same endpoint moves to the user who subscribed last. */
  async subscribe(userId: string, dto: PushSubscriptionInput, userAgent?: string): Promise<void> {
    const data = {
      userId,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: userAgent ?? null,
    };
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { endpoint: dto.endpoint, ...data },
      update: data,
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /** Exposed for tests; use notify() in application code. */
  async send(
    userId: string,
    category: PushCategory,
    build: (language: Language) => PushPayload,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        language: true,
        notificationSettings: true,
        pushSubscriptions: { select: { endpoint: true, p256dh: true, auth: true } },
      },
    });
    if (!user || user.pushSubscriptions.length === 0) return;

    // No settings row = defaults (everything on)
    const settings = user.notificationSettings;
    if (settings) {
      if (!settings.pushEnabled || !settings[category]) return;
      if (settings.pausedUntil && settings.pausedUntil > new Date()) return;
    }

    const payload = build(user.language);
    const body = JSON.stringify(payload);
    const options = {
      TTL: payload.type === 'CALL' ? TTL_CALL : TTL_DEFAULT,
      vapidDetails: {
        subject: this.config.get('VAPID_SUBJECT'),
        publicKey: this.config.get('VAPID_PUBLIC_KEY') ?? '',
        privateKey: this.config.get('VAPID_PRIVATE_KEY') ?? '',
      },
    };

    const expired: string[] = [];
    await Promise.all(
      user.pushSubscriptions.map(async (sub) => {
        try {
          await sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
            options,
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 404 / 410 = the browser unsubscribed or the subscription expired
          if (status === 404 || status === 410) expired.push(sub.endpoint);
          else this.logger.warn(`Push to ${userId} failed with status ${status ?? 'unknown'}`);
        }
      }),
    );

    if (expired.length > 0) {
      await this.prisma.pushSubscription.deleteMany({ where: { endpoint: { in: expired } } });
    }
  }
}
