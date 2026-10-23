import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LiveStream as LiveRow } from '@prisma/client';
import type { WebhookEvent } from 'livekit-server-sdk';
import {
  ErrorCode,
  LIVE_HOST_GRACE_SECONDS,
  type LiveJoin,
  type LiveStream,
  ServerEvent,
} from '@instagram/shared';
import { conflict, forbidden, notFound } from '../../common/errors/app-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { LiveKitEventsService } from '../calls/livekit-events.service';
import { LiveKitService } from '../calls/livekit.service';
import { FollowsService } from '../follows/follows.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { UserPreviewService, userPreviewSelect } from '../users/user-preview.service';

const ROOM_PREFIX = 'live_';
// Followers are notified in small batches so a big audience doesn't flood the database
const NOTIFY_BATCH = 25;

const withHost = { host: { select: userPreviewSelect } } as const;

/**
 * Live videos (LIVE-*, docs/spec/live.md). One LiveKit room per live: the host publishes the
 * camera and microphone, viewers only subscribe. Chat, hearts and the viewer count travel in
 * the room itself (LiveKit data messages), so this service only keeps LiveStream in sync,
 * hands out tokens and tells followers.
 */
@Injectable()
export class LivesService implements OnModuleInit {
  private readonly logger = new Logger(LivesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly follows: FollowsService,
    private readonly userPreview: UserPreviewService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly livekit: LiveKitService,
    private readonly livekitEvents: LiveKitEventsService,
  ) {}

  onModuleInit(): void {
    this.livekitEvents.subscribe(ROOM_PREFIX, (event) => this.onLiveKitEvent(event));
  }

  /** LIVE-1: go live. A second "go live" while one is running rejoins it. */
  async start(hostId: string): Promise<LiveJoin> {
    const { live, created } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`live:${hostId}`}))`;
      const running = await tx.liveStream.findFirst({
        where: { hostId, status: 'LIVE' },
        include: withHost,
      });
      if (running) return { live: running, created: false };
      const fresh = await tx.liveStream.create({
        data: { hostId, roomName: `${ROOM_PREFIX}${randomUUID()}` },
        include: withHost,
      });
      return { live: fresh, created: true };
    });

    const join = await this.joinInfo(hostId, live, true);
    if (created) void this.announce(live.id, hostId);
    return join;
  }

  /** The live a user is running right now (the page /live/:username) */
  async byUsername(viewerId: string, username: string): Promise<LiveStream> {
    const live = await this.prisma.liveStream.findFirst({
      where: { status: 'LIVE', host: { username } },
      include: withHost,
    });
    if (!live) throw notFound(ErrorCode.LIVE_NOT_FOUND, 'This live video has ended.');
    await this.assertCanWatch(viewerId, live.hostId);
    return this.toDto(viewerId, live);
  }

  /** LIVE-3: lives of people I follow (and my own), for the LIVE rings */
  async following(viewerId: string): Promise<LiveStream[]> {
    const rows = await this.prisma.liveStream.findMany({
      where: {
        status: 'LIVE',
        OR: [
          { hostId: viewerId },
          {
            host: {
              followers: { some: { followerId: viewerId, status: 'ACCEPTED' } },
              blocking: { none: { blockedId: viewerId } },
              blockedBy: { none: { blockerId: viewerId } },
            },
          },
        ],
      },
      include: withHost,
      orderBy: { startedAt: 'desc' },
    });
    const hosts = await this.userPreview.build(
      viewerId,
      rows.map((r) => r.host),
    );
    return rows.flatMap((row) => {
      const host = hosts.get(row.hostId);
      return host ? [toLiveDto(row, host)] : [];
    });
  }

  /** LIVE-4: a token to watch (or, for the host, to broadcast again after a reload) */
  async join(userId: string, id: string): Promise<LiveJoin> {
    const live = await this.prisma.liveStream.findUnique({ where: { id }, include: withHost });
    if (!live) throw notFound(ErrorCode.LIVE_NOT_FOUND, 'Live video not found.');
    const isHost = live.hostId === userId;
    if (!isHost) await this.assertCanWatch(userId, live.hostId);
    if (live.status !== 'LIVE') throw conflict(ErrorCode.LIVE_ENDED, 'This live video has ended.');
    return this.joinInfo(userId, live, isHost);
  }

  /** LIVE-6: the host ends the live */
  async end(userId: string, id: string): Promise<void> {
    const live = await this.prisma.liveStream.findUnique({
      where: { id },
      select: { hostId: true },
    });
    if (!live || live.hostId !== userId) {
      throw notFound(ErrorCode.LIVE_NOT_FOUND, 'Live video not found.');
    }
    await this.finish(id);
  }

  /** ADMIN-4: a banned host's live ends at once */
  async endAllOf(hostId: string): Promise<void> {
    const lives = await this.prisma.liveStream.findMany({
      where: { hostId, status: 'LIVE' },
      select: { id: true },
    });
    for (const live of lives) await this.finish(live.id);
  }

  /** LIVE-6: a live whose host has been gone for a minute ends by itself */
  @Interval(10_000)
  async sweep(): Promise<void> {
    const before = new Date(Date.now() - LIVE_HOST_GRACE_SECONDS * 1000);
    const stale = await this.prisma.liveStream.findMany({
      where: { status: 'LIVE', hostLeftAt: { lt: before } },
      select: { id: true },
    });
    for (const live of stale) await this.finish(live.id);
  }

  // ───────────── Internals ─────────────

  private async onLiveKitEvent(event: WebhookEvent): Promise<void> {
    const roomName = event.room?.name;
    if (!roomName) return;
    const live = await this.prisma.liveStream.findUnique({
      where: { roomName },
      select: { id: true, hostId: true, status: true },
    });
    if (!live || live.status !== 'LIVE') return;

    if (event.event === 'room_finished') return this.finish(live.id);
    if (event.participant?.identity !== live.hostId) return;
    if (event.event === 'participant_joined') {
      await this.prisma.liveStream.update({ where: { id: live.id }, data: { hostLeftAt: null } });
    } else if (
      event.event === 'participant_left' ||
      event.event === 'participant_connection_aborted'
    ) {
      await this.prisma.liveStream.update({
        where: { id: live.id },
        data: { hostLeftAt: new Date() },
      });
    }
  }

  /** Ends the live once: the room is closed (viewers see "Live ended") and rings go away */
  private async finish(id: string): Promise<void> {
    const ended = await this.prisma.liveStream.updateManyAndReturn({
      where: { id, status: 'LIVE' },
      data: { status: 'ENDED', endedAt: new Date(), hostLeftAt: null },
      select: { id: true, hostId: true, roomName: true },
    });
    const live = ended[0];
    if (!live) return;
    this.livekit.closeRoom(live.roomName);
    const audience = await this.followerIds(live.hostId);
    this.realtime.emitToUsers([live.hostId, ...audience], ServerEvent.LIVE_ENDED, {
      liveId: live.id,
      hostId: live.hostId,
    });
  }

  /** LIVE-2: followers get a notification + push, and their rings refresh */
  private async announce(liveId: string, hostId: string): Promise<void> {
    try {
      const followerIds = await this.followerIds(hostId);
      this.realtime.emitToUsers([hostId, ...followerIds], ServerEvent.LIVE_STARTED, {
        liveId,
        hostId,
      });
      for (let i = 0; i < followerIds.length; i += NOTIFY_BATCH) {
        await Promise.all(
          followerIds
            .slice(i, i + NOTIFY_BATCH)
            .map((recipientId) =>
              this.notifications.create({ recipientId, actorId: hostId, type: 'LIVE_STARTED' }),
            ),
        );
      }
    } catch (error) {
      this.logger.error(`Failed to announce live ${liveId}: ${String(error)}`);
    }
  }

  private async followerIds(hostId: string): Promise<string[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followingId: hostId, status: 'ACCEPTED' },
      select: { followerId: true },
    });
    return rows.map((r) => r.followerId);
  }

  /** LIVE-7: a private account's live is for its approved followers only */
  private async assertCanWatch(viewerId: string, hostId: string): Promise<void> {
    if (await this.follows.isBlockedBetween(viewerId, hostId)) {
      throw notFound(ErrorCode.LIVE_NOT_FOUND, 'Live video not found.');
    }
    if (!(await this.follows.canViewContent(viewerId, hostId))) {
      throw forbidden(ErrorCode.PRIVATE_ACCOUNT, 'This account is private.');
    }
  }

  private async joinInfo(
    userId: string,
    live: LiveRow & { host: HostRow },
    isHost: boolean,
  ): Promise<LiveJoin> {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true, avatarUrl: true },
    });
    const token = await this.livekit.createToken(me, live.roomName, { canPublish: isHost });
    return {
      live: await this.toDto(userId, live),
      token,
      url: this.livekit.url,
      isHost,
    };
  }

  private async toDto(viewerId: string, live: LiveRow & { host: HostRow }): Promise<LiveStream> {
    return toLiveDto(live, await this.userPreview.buildOne(viewerId, live.host));
  }
}

type HostRow = Parameters<UserPreviewService['buildOne']>[1];

function toLiveDto(row: LiveRow, host: LiveStream['host']): LiveStream {
  return {
    id: row.id,
    host,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
  };
}
