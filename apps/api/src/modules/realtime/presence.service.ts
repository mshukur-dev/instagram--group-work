import { Injectable } from '@nestjs/common';
import { type PresenceState, ServerEvent } from '@instagram/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from './realtime.service';

const hidden = (userId: string): PresenceState => ({ userId, isOnline: false, lastSeenAt: null });

/**
 * Online status and typing (docs/spec/realtime.md §4). Status is shared only with
 * people who have a chat with the user, and never when showActivityStatus is off
 * on either side (database.md §4).
 */
@Injectable()
export class PresenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async connected(userId: string, socketId: string): Promise<void> {
    if (!this.realtime.addSocket(userId, socketId)) return;
    await this.broadcast(userId, { userId, isOnline: true, lastSeenAt: null });
  }

  async disconnected(userId: string, socketId: string): Promise<void> {
    if (!this.realtime.removeSocket(userId, socketId)) return;
    const lastSeenAt = new Date();
    await this.prisma.user.updateMany({ where: { id: userId }, data: { lastSeenAt } });
    await this.broadcast(userId, { userId, isOnline: false, lastSeenAt: lastSeenAt.toISOString() });
  }

  /** Current states for presence:subscribe; users the viewer may not see come back as offline. */
  async states(viewerId: string, userIds: string[]): Promise<PresenceState[]> {
    const requested = [...new Set(userIds)].filter((id) => id !== viewerId);
    if (requested.length === 0) return [];

    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { showActivityStatus: true },
    });
    if (!viewer?.showActivityStatus) return requested.map(hidden);

    const partners = new Set(await this.partnerIds(viewerId));
    const visibleIds = requested.filter((id) => partners.has(id));
    const users = visibleIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: visibleIds } },
          select: { id: true, lastSeenAt: true },
        })
      : [];
    const lastSeen = new Map(users.map((u) => [u.id, u.lastSeenAt]));

    return requested.map((id) => {
      if (!lastSeen.has(id)) return hidden(id);
      const online = this.realtime.isOnline(id);
      return {
        userId: id,
        isOnline: online,
        lastSeenAt: online ? null : (lastSeen.get(id)?.toISOString() ?? null),
      };
    });
  }

  /** Relays "typing…" to the other members; ignored for non-members. */
  async typing(userId: string, conversationId: string, isTyping: boolean): Promise<void> {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });
    if (!members.some((m) => m.userId === userId)) return;
    const others = members.map((m) => m.userId).filter((id) => id !== userId);
    this.realtime.emitToUsers(others, ServerEvent.TYPING, { conversationId, userId, isTyping });
  }

  private async broadcast(userId: string, state: PresenceState): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { showActivityStatus: true },
    });
    if (!user?.showActivityStatus) return;
    const recipients = await this.partnerIds(userId);
    this.realtime.emitToUsers(recipients, ServerEvent.PRESENCE, state);
  }

  /**
   * Users who share an active chat with this user and show their own activity status
   * (if you hide yours, you don't see others' either).
   */
  private async partnerIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ userId: string }[]>`
      SELECT DISTINCT other."userId"
      FROM conversation_members me
      JOIN conversation_members other
        ON other."conversationId" = me."conversationId"
       AND other."userId" <> me."userId"
       AND other."leftAt" IS NULL
      JOIN users u ON u.id = other."userId"
      WHERE me."userId" = ${userId}
        AND me."leftAt" IS NULL
        AND u."showActivityStatus" = true`;
    return rows.map((r) => r.userId);
  }
}
