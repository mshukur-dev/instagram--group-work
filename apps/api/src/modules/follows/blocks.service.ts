import { Injectable } from '@nestjs/common';
import { ErrorCode, type FollowStatus, type UserPreview } from '@instagram/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest } from '../../common/errors/app-exception';
import { NotificationsService } from '../notifications/notifications.service';
import { UserPreviewService, userPreviewSelect } from '../users/user-preview.service';
import { UsersService } from '../users/users.service';
import { removeFollowTx } from './follow-graph';

/** PROFILE-6, SETTINGS-8. */
@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly userPreview: UserPreviewService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Blocks the user and removes follows in both directions (with counters). Idempotent. */
  async block(viewerId: string, username: string): Promise<void> {
    const target = await this.users.findByUsernameOrThrow(username);
    if (target.id === viewerId) {
      throw badRequest(ErrorCode.CANNOT_BLOCK_SELF, "You can't block yourself.");
    }

    const removed = await this.prisma.$transaction(async (tx) => {
      await tx.block.createMany({
        data: [{ blockerId: viewerId, blockedId: target.id }],
        skipDuplicates: true,
      });
      const mine = await removeFollowTx(tx, viewerId, target.id);
      const theirs = await removeFollowTx(tx, target.id, viewerId);
      await tx.searchHistory.deleteMany({
        where: {
          OR: [
            { searcherId: viewerId, searchedId: target.id },
            { searcherId: target.id, searchedId: viewerId },
          ],
        },
      });
      return { mine, theirs };
    });

    await this.removeFollowNotification(viewerId, target.id, removed.mine);
    await this.removeFollowNotification(target.id, viewerId, removed.theirs);
  }

  async unblock(viewerId: string, username: string): Promise<void> {
    const target = await this.users.findByUsernameOrThrow(username);
    await this.prisma.block.deleteMany({ where: { blockerId: viewerId, blockedId: target.id } });
  }

  /** Users I blocked, newest first. */
  async listBlocked(viewerId: string): Promise<UserPreview[]> {
    const rows = await this.prisma.block.findMany({
      where: { blockerId: viewerId },
      orderBy: { createdAt: 'desc' },
      select: { blocked: { select: userPreviewSelect } },
    });
    // No story rings for blocked users
    return rows.map((r) => this.userPreview.toPreview(r.blocked));
  }

  private async removeFollowNotification(
    followerId: string,
    followingId: string,
    status: FollowStatus | null,
  ): Promise<void> {
    if (!status) return;
    await this.notifications.remove({
      recipientId: followingId,
      actorId: followerId,
      type: status === 'PENDING' ? 'FOLLOW_REQUEST' : 'FOLLOW',
    });
  }
}
