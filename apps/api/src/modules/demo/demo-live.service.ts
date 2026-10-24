import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LiveKitService } from '../calls/livekit.service';
import { BOT_EMAIL_DOMAIN } from './demo-bots.service';
import { LIVE_COMMENTS, pick } from './demo-lines';

/** Topic of the demo audience's data messages; the live page listens to it (live-stage.tsx) */
export const DEMO_LIVE_TOPIC = 'live-demo';

type Viewer = { username: string; avatarUrl: string | null; lang: 'en' | 'ru' };
type Audience = { viewers: Viewer[]; target: number; nextCommentAt: number; nextCountAt: number };

const chance = (p: number) => Math.random() < p;
const between = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * A demo audience for every live (DEMO_BOTS=true): demo accounts "join" one by one up to a few
 * dozen, comment every few seconds and keep hearts floating. They aren't LiveKit participants:
 * the server sends data messages to the room and the page shows them like real ones, adding them
 * to the viewer count.
 */
@Injectable()
export class DemoLiveService {
  private readonly logger = new Logger(DemoLiveService.name);
  private readonly audiences = new Map<string, Audience>();
  private pool: Viewer[] = [];
  private poolAt = 0;
  private busy = false;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly livekit: LiveKitService,
  ) {}

  private async loadPool(): Promise<void> {
    if (this.pool.length && Date.now() - this.poolAt < 10 * 60_000) return;
    const rows = await this.prisma.user.findMany({
      where: { email: { endsWith: BOT_EMAIL_DOMAIN }, bannedAt: null },
      select: { username: true, avatarUrl: true, language: true },
    });
    this.pool = rows.map((r) => ({
      username: r.username,
      avatarUrl: r.avatarUrl,
      lang: r.language === 'RU' ? 'ru' : 'en',
    }));
    this.poolAt = Date.now();
  }

  @Interval(1_200)
  async tick(): Promise<void> {
    if (!this.config.get('DEMO_BOTS') || this.busy) return;
    this.busy = true;
    try {
      const lives = await this.prisma.liveStream.findMany({
        where: { status: 'LIVE' },
        select: { id: true, roomName: true },
      });
      // Lives that ended take their audience with them
      for (const id of this.audiences.keys()) {
        if (!lives.some((l) => l.id === id)) this.audiences.delete(id);
      }
      if (!lives.length) return;
      await this.loadPool();
      if (!this.pool.length) return;
      await Promise.all(lives.map((live) => this.liven(live.id, live.roomName)));
    } catch (error) {
      this.logger.warn(`live: ${(error as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  private async liven(liveId: string, room: string): Promise<void> {
    const now = Date.now();
    let audience = this.audiences.get(liveId);
    if (!audience) {
      audience = {
        viewers: [],
        target: Math.round(between(25, 120)),
        nextCommentAt: now + 3000,
        nextCountAt: now,
      };
      this.audiences.set(liveId, audience);
    }
    const send = (payload: unknown) =>
      this.livekit.sendData(room, payload, DEMO_LIVE_TOPIC).catch(() => undefined);

    // People keep coming in (faster at the start), a few leave now and then
    if (
      audience.viewers.length < audience.target &&
      chance(audience.viewers.length < 10 ? 0.9 : 0.4)
    ) {
      const fresh = this.pool.filter((p) => !audience.viewers.includes(p));
      const viewer = fresh.length ? pick(fresh) : undefined;
      if (viewer) {
        audience.viewers.push(viewer);
        if (chance(0.6)) {
          await send({ type: 'joined', username: viewer.username, avatarUrl: viewer.avatarUrl });
        }
      }
    } else if (audience.viewers.length > 5 && chance(0.05)) {
      audience.viewers.splice(Math.floor(Math.random() * audience.viewers.length), 1);
    }

    if (audience.viewers.length && now >= audience.nextCommentAt) {
      const who = pick(audience.viewers);
      await send({
        type: 'comment',
        username: who.username,
        avatarUrl: who.avatarUrl,
        text: pick(LIVE_COMMENTS[who.lang]),
      });
      audience.nextCommentAt = now + between(1800, 5500);
    }

    if (audience.viewers.length && chance(0.7)) {
      await send({ type: 'hearts', count: Math.ceil(between(0, 3)) });
    }

    if (now >= audience.nextCountAt) {
      await send({ type: 'viewers', count: audience.viewers.length });
      audience.nextCountAt = now + 3000;
    }
  }
}
