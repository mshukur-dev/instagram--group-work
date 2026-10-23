import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { CallStatus } from '@prisma/client';
import {
  CALL_MAX_PARTICIPANTS,
  CALL_RING_TIMEOUT_SECONDS,
  type CallJoin,
  type CallType,
  ErrorCode,
  ServerEvent,
} from '@instagram/shared';
import { conflict, notFound } from '../../common/errors/app-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MembersService } from '../messages/members.service';
import { MessagesService } from '../messages/messages.service';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';
import { UserPreviewService, userPreviewSelect } from '../users/user-preview.service';
import { type CallWithCount, toCallJoinCall, toCallSummary } from './calls.mapper';
import { buildCallEndedPush, buildIncomingCallPush } from './calls.push';
import { LiveKitService } from './livekit.service';

const OPEN: CallStatus[] = ['RINGING', 'ACTIVE'];
const withCount = { _count: { select: { participants: true } } } as const;

/**
 * Who can call and the call lifecycle (docs/spec/calls.md). Media goes through LiveKit;
 * this service only keeps Call / CallParticipant in sync and signals over Socket.IO.
 *
 * 1:1: RINGING → ACTIVE (callee joined) → ENDED when anyone leaves;
 *      declined / not answered in 30 s / callee busy → MISSED.
 * Group: ACTIVE right away → ENDED when the last participant leaves.
 */
@Injectable()
export class CallsService implements OnModuleDestroy {
  private readonly logger = new Logger(CallsService.name);
  private readonly ringTimers = new Map<string, NodeJS.Timeout>();
  /** Overridable in tests */
  ringTimeoutMs = CALL_RING_TIMEOUT_SECONDS * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
    private readonly messages: MessagesService,
    private readonly conversations: ConversationsService,
    private readonly userPreview: UserPreviewService,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
    private readonly livekit: LiveKitService,
  ) {}

  onModuleDestroy(): void {
    for (const timer of this.ringTimers.values()) clearTimeout(timer);
    this.ringTimers.clear();
  }

  async start(userId: string, conversationId: string, type: CallType): Promise<CallJoin> {
    const membership = await this.members.requireMember(userId, conversationId);
    await this.members.assertNotBlocked(userId, membership);
    const memberIds = await this.members.activeMemberIds(conversationId);
    const otherIds = memberIds.filter((id) => id !== userId);

    // 1:1 callee already in another call → the call is missed right away
    const calleeBusy = !membership.isGroup && otherIds[0] ? await this.isBusy(otherIds[0]) : false;

    const call = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`call:${conversationId}`}))`;
      const active = await tx.call.findFirst({
        where: { conversationId, status: { in: OPEN } },
        select: { id: true },
      });
      if (active) {
        throw conflict(ErrorCode.CALL_ALREADY_ACTIVE, 'A call is already in progress.', {
          details: { callId: active.id },
        });
      }
      const now = new Date();
      let status: CallStatus = membership.isGroup ? 'ACTIVE' : 'RINGING';
      if (calleeBusy) status = 'MISSED';
      const created = await tx.call.create({
        data: {
          conversationId,
          startedById: userId,
          type,
          status,
          roomName: `pending_${randomUUID()}`,
          startedAt: now,
          answeredAt: membership.isGroup ? now : null,
          endedAt: calleeBusy ? now : null,
          participants: { create: { userId, joinedAt: now, leftAt: calleeBusy ? now : null } },
        },
        select: { id: true },
      });
      return tx.call.update({
        where: { id: created.id },
        data: { roomName: `call_${created.id}` },
        include: withCount,
      });
    });

    const join = await this.toJoin(userId, call);

    if (calleeBusy) {
      this.realtime.emitToUser(userId, ServerEvent.CALL_ENDED, { callId: call.id, conversationId });
      await this.messages.createCallRecord(call);
      return join;
    }

    if (!membership.isGroup) this.scheduleRingTimeout(call.id);
    await this.emitIncoming(call, userId, otherIds, membership.isGroup);
    this.emitUpdated(call, memberIds, [userId]);
    return join;
  }

  /** Accept a 1:1 call or join a group call (also used to rejoin). */
  async join(userId: string, callId: string): Promise<CallJoin> {
    const call = await this.findForMember(userId, callId);
    if (!OPEN.includes(call.status)) throw conflict(ErrorCode.CALL_ENDED, 'This call has ended.');

    const othersInCall = await this.prisma.callParticipant.count({
      where: { callId, leftAt: null, userId: { not: userId } },
    });
    if (othersInCall >= CALL_MAX_PARTICIPANTS) {
      throw conflict(ErrorCode.CALL_FULL, 'This call is full.');
    }

    const now = new Date();
    await this.prisma.callParticipant.upsert({
      where: { callId_userId: { callId, userId } },
      create: { callId, userId, joinedAt: now },
      update: { leftAt: null },
    });

    const answered = call.status === 'RINGING' && userId !== call.startedById;
    if (answered) {
      await this.prisma.call.updateMany({
        where: { id: callId, status: 'RINGING' },
        data: { status: 'ACTIVE', answeredAt: now },
      });
      this.clearRingTimer(callId);
      // close the ringing notification on the callee's other devices
      this.push.notify(userId, 'calls', () => buildCallEndedPush(callId, call.conversationId));
    }

    const fresh = await this.prisma.call.findUniqueOrThrow({
      where: { id: callId },
      include: withCount,
    });
    const memberIds = await this.members.activeMemberIds(call.conversationId);
    await this.emitUpdatedFromDb(fresh, memberIds);
    return this.toJoin(userId, fresh);
  }

  /** 1:1 only: the callee (or the caller, to cancel) rejects a ringing call. No-op for groups. */
  async decline(userId: string, callId: string): Promise<void> {
    const call = await this.findForMember(userId, callId);
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: call.conversationId },
      select: { isGroup: true },
    });
    if (conversation.isGroup || call.status !== 'RINGING') return;
    await this.finish(callId, 'MISSED');
  }

  async leave(userId: string, callId: string): Promise<void> {
    await this.findForMember(userId, callId);
    await this.leaveInternal(userId, callId);
  }

  /** LiveKit webhook (calls.md §7): keeps participants in sync when a tab is just closed. */
  async handleWebhook(body: string, authHeader: string | undefined): Promise<boolean> {
    const event = await this.livekit.receiveWebhook(body, authHeader);
    if (!event) return false;

    const roomName = event.room?.name;
    if (!roomName?.startsWith('call_')) return true;
    const call = await this.prisma.call.findUnique({
      where: { roomName },
      select: { id: true, conversationId: true, status: true },
    });
    if (!call || !OPEN.includes(call.status)) return true;

    const identity = event.participant?.identity;
    switch (event.event) {
      case 'participant_joined':
        if (identity && (await this.members.isActiveMember(identity, call.conversationId))) {
          await this.prisma.callParticipant.upsert({
            where: { callId_userId: { callId: call.id, userId: identity } },
            create: { callId: call.id, userId: identity },
            update: { leftAt: null },
          });
          const fresh = await this.prisma.call.findUniqueOrThrow({
            where: { id: call.id },
            include: withCount,
          });
          await this.emitUpdatedFromDb(
            fresh,
            await this.members.activeMemberIds(call.conversationId),
          );
        }
        break;
      case 'participant_left':
      case 'participant_connection_aborted':
        if (identity) await this.leaveInternal(identity, call.id);
        break;
      case 'room_finished':
        await this.finish(call.id, call.status === 'RINGING' ? 'MISSED' : 'ENDED');
        break;
      default:
        break;
    }
    return true;
  }

  /** Safety net after a restart or a lost webhook: unanswered and empty calls are closed. */
  @Interval(60_000)
  async sweepStaleCalls(): Promise<void> {
    try {
      const ringingBefore = new Date(Date.now() - this.ringTimeoutMs);
      const stale = await this.prisma.call.findMany({
        where: {
          OR: [
            { status: 'RINGING', startedAt: { lt: ringingBefore } },
            { status: 'ACTIVE', participants: { none: { leftAt: null } } },
          ],
        },
        select: { id: true, status: true },
      });
      for (const call of stale) {
        await this.finish(call.id, call.status === 'RINGING' ? 'MISSED' : 'ENDED');
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  // ───────────── private ─────────────

  private async leaveInternal(userId: string, callId: string): Promise<void> {
    const { count } = await this.prisma.callParticipant.updateMany({
      where: { callId, userId, leftAt: null },
      data: { leftAt: new Date() },
    });
    if (count === 0) return;

    const call = await this.prisma.call.findUniqueOrThrow({
      where: { id: callId },
      include: { ...withCount, conversation: { select: { isGroup: true } } },
    });
    if (!OPEN.includes(call.status)) return;

    if (!call.conversation.isGroup) {
      // 1:1 ends when anyone leaves; a caller hanging up before an answer = missed
      await this.finish(callId, call.status === 'RINGING' ? 'MISSED' : 'ENDED');
      return;
    }
    const remaining = await this.prisma.callParticipant.count({ where: { callId, leftAt: null } });
    if (remaining === 0) {
      await this.finish(callId, 'ENDED');
      return;
    }
    await this.emitUpdatedFromDb(call, await this.members.activeMemberIds(call.conversationId));
  }

  /** Closes the call once (idempotent), records it in the chat and tells everyone. */
  private async finish(callId: string, status: 'ENDED' | 'MISSED'): Promise<void> {
    const now = new Date();
    const { count } = await this.prisma.call.updateMany({
      where: { id: callId, status: { in: OPEN } },
      data: { status, endedAt: now },
    });
    this.clearRingTimer(callId);
    if (count === 0) return;

    await this.prisma.callParticipant.updateMany({
      where: { callId, leftAt: null },
      data: { leftAt: now },
    });
    const call = await this.prisma.call.findUniqueOrThrow({ where: { id: callId } });
    this.livekit.closeRoom(call.roomName);

    const memberIds = await this.members.activeMemberIds(call.conversationId);
    this.realtime.emitToUsers(memberIds, ServerEvent.CALL_ENDED, {
      callId,
      conversationId: call.conversationId,
    });
    for (const memberId of memberIds) {
      if (memberId === call.startedById) continue;
      this.push.notify(memberId, 'calls', () => buildCallEndedPush(callId, call.conversationId));
    }
    await this.messages.createCallRecord(call);
  }

  private scheduleRingTimeout(callId: string): void {
    const timer = setTimeout(() => {
      this.ringTimers.delete(callId);
      this.prisma.call
        .findUnique({ where: { id: callId }, select: { status: true } })
        .then((call) => (call?.status === 'RINGING' ? this.finish(callId, 'MISSED') : undefined))
        .catch((error: unknown) => this.logger.error(error));
    }, this.ringTimeoutMs);
    timer.unref();
    this.ringTimers.set(callId, timer);
  }

  private clearRingTimer(callId: string): void {
    const timer = this.ringTimers.get(callId);
    if (timer) clearTimeout(timer);
    this.ringTimers.delete(callId);
  }

  /** In another open call: joined it, or a 1:1 call is ringing for them right now. */
  private async isBusy(userId: string): Promise<boolean> {
    const count = await this.prisma.call.count({
      where: {
        status: { in: OPEN },
        OR: [
          { participants: { some: { userId, leftAt: null } } },
          {
            status: 'RINGING',
            startedById: { not: userId },
            conversation: { isGroup: false, members: { some: { userId } } },
          },
        ],
      },
    });
    return count > 0;
  }

  /** Strangers get 404, like for conversations. */
  private async findForMember(userId: string, callId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      select: { id: true, conversationId: true, status: true, startedById: true },
    });
    if (!call || !(await this.members.isActiveMember(userId, call.conversationId))) {
      throw notFound(ErrorCode.CALL_NOT_FOUND, 'Call not found.');
    }
    return call;
  }

  private async toJoin(userId: string, call: CallWithCount): Promise<CallJoin> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true, avatarUrl: true },
    });
    return {
      call: toCallJoinCall(call),
      token: await this.livekit.createToken(user, call.roomName),
      url: this.livekit.url,
    };
  }

  /** call:incoming (each member gets the chat preview as they see it) + push with Accept / Decline. */
  private async emitIncoming(
    call: CallWithCount,
    callerId: string,
    recipientIds: string[],
    isGroup: boolean,
  ): Promise<void> {
    if (recipientIds.length === 0) return;
    const [previews, caller] = await Promise.all([
      this.conversations.previewsForMembers(call.conversationId),
      this.prisma.user.findUniqueOrThrow({ where: { id: callerId }, select: userPreviewSelect }),
    ]);
    const summary = { ...toCallSummary(call), conversationId: call.conversationId };

    await Promise.all(
      recipientIds.map(async (recipientId) => {
        const conversation = previews.get(recipientId);
        if (!conversation) return;
        const callerPreview = await this.userPreview.buildOne(recipientId, caller);
        // A muted chat still learns about the call (the "Join" button), the app just doesn't ring
        this.realtime.emitToUser(recipientId, ServerEvent.CALL_INCOMING, {
          call: summary,
          conversation,
          caller: callerPreview,
        });
      }),
    );

    const input = {
      callId: call.id,
      conversationId: call.conversationId,
      isGroup,
      type: call.type,
      callerUsername: caller.username,
      callerAvatarUrl: caller.avatarUrl,
    };
    for (const recipientId of recipientIds) {
      if (previews.get(recipientId)?.muted.calls) continue;
      this.push.notify(recipientId, 'calls', (language) => buildIncomingCallPush(language, input));
    }
  }

  private emitUpdated(call: CallWithCount, memberIds: string[], participantIds: string[]): void {
    this.realtime.emitToUsers(memberIds, ServerEvent.CALL_UPDATED, {
      callId: call.id,
      conversationId: call.conversationId,
      status: call.status,
      participantIds,
    });
  }

  private async emitUpdatedFromDb(call: CallWithCount, memberIds: string[]): Promise<void> {
    const participants = await this.prisma.callParticipant.findMany({
      where: { callId: call.id, leftAt: null },
      select: { userId: true },
      orderBy: { joinedAt: 'asc' },
    });
    this.emitUpdated(
      call,
      memberIds,
      participants.map((p) => p.userId),
    );
  }
}
