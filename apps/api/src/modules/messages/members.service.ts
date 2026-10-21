import { Injectable } from '@nestjs/common';
import type { MemberRole } from '@prisma/client';
import { ErrorCode } from '@instagram/shared';
import { forbidden, notFound } from '../../common/errors/app-exception';
import { PrismaService } from '../../prisma/prisma.service';
import { FollowsService } from '../follows/follows.service';

export type Membership = {
  conversationId: string;
  isGroup: boolean;
  role: MemberRole;
};

/**
 * Who may read and write in a conversation (docs/spec/database.md §4):
 * only a ConversationMember without leftAt. Used by conversations, messages and calls.
 */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly follows: FollowsService,
  ) {}

  /** Throws 404 for strangers (don't reveal the chat exists) and 403 for former members. */
  async requireMember(userId: string, conversationId: string): Promise<Membership> {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { role: true, leftAt: true, conversation: { select: { isGroup: true } } },
    });
    if (!member) throw notFound(ErrorCode.CONVERSATION_NOT_FOUND, 'Conversation not found.');
    if (member.leftAt) throw forbidden(ErrorCode.NOT_A_MEMBER, "You're no longer in this chat.");
    return { conversationId, isGroup: member.conversation.isGroup, role: member.role };
  }

  async isActiveMember(userId: string, conversationId: string): Promise<boolean> {
    const count = await this.prisma.conversationMember.count({
      where: { conversationId, userId, leftAt: null },
    });
    return count > 0;
  }

  async activeMemberIds(conversationId: string): Promise<string[]> {
    const rows = await this.prisma.conversationMember.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((r) => r.userId);
  }

  /** The other member of a 1:1 conversation (null for groups or a deleted account). */
  async otherDirectMember(userId: string, conversationId: string): Promise<string | null> {
    const row = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId: { not: userId }, conversation: { isGroup: false } },
      select: { userId: true },
    });
    return row?.userId ?? null;
  }

  /** In a 1:1 chat nobody can write or call while either side blocks the other. */
  async assertNotBlocked(userId: string, membership: Membership): Promise<void> {
    if (membership.isGroup) return;
    const otherId = await this.otherDirectMember(userId, membership.conversationId);
    if (otherId && (await this.follows.isBlockedBetween(userId, otherId))) {
      throw forbidden(ErrorCode.MESSAGING_NOT_ALLOWED, "You can't message this account.");
    }
  }
}
