import type { Call } from '@prisma/client';
import type { CallJoin, CallSummary } from '@instagram/shared';

export type CallWithCount = Call & { _count: { participants: number } };

export function toCallSummary(call: CallWithCount): CallSummary {
  return {
    id: call.id,
    type: call.type,
    status: call.status,
    startedById: call.startedById,
    startedAt: call.startedAt.toISOString(),
    answeredAt: call.answeredAt?.toISOString() ?? null,
    endedAt: call.endedAt?.toISOString() ?? null,
    participantsCount: call._count.participants,
  };
}

export function toCallJoinCall(call: CallWithCount): CallJoin['call'] {
  return { ...toCallSummary(call), conversationId: call.conversationId, roomName: call.roomName };
}
