import type { FollowStatus, Prisma } from '@prisma/client';

/**
 * Low-level follow graph writes that keep the counters in sync.
 * They take a transaction client so callers can combine them with other writes
 * (block, privacy switch) in one `$transaction`.
 */

/** Deletes a follow and decrements counters if it was accepted. Returns the removed status. */
export async function removeFollowTx(
  tx: Prisma.TransactionClient,
  followerId: string,
  followingId: string,
): Promise<FollowStatus | null> {
  const follow = await tx.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { status: true },
  });
  if (!follow) return null;

  // deleteMany + count: a concurrent request may have deleted it already
  const { count } = await tx.follow.deleteMany({
    where: { followerId, followingId, status: follow.status },
  });
  if (count === 0) return null;

  if (follow.status === 'ACCEPTED') {
    await tx.user.update({
      where: { id: followerId },
      data: { followingCount: { decrement: 1 } },
    });
    await tx.user.update({
      where: { id: followingId },
      data: { followersCount: { decrement: 1 } },
    });
  }
  return follow.status;
}

/** Accepts one pending request with counters. Returns false if there was no pending request. */
export async function acceptFollowTx(
  tx: Prisma.TransactionClient,
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const { count } = await tx.follow.updateMany({
    where: { followerId, followingId, status: 'PENDING' },
    data: { status: 'ACCEPTED' },
  });
  if (count === 0) return false;
  await tx.user.update({ where: { id: followerId }, data: { followingCount: { increment: 1 } } });
  await tx.user.update({ where: { id: followingId }, data: { followersCount: { increment: 1 } } });
  return true;
}

/** Accepts every pending request to the user (account became public). Returns follower ids. */
export async function acceptAllPendingTx(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<string[]> {
  const pending = await tx.follow.findMany({
    where: { followingId: userId, status: 'PENDING' },
    select: { followerId: true },
  });
  const followerIds = pending.map((p) => p.followerId);
  if (followerIds.length === 0) return [];

  const { count } = await tx.follow.updateMany({
    where: { followingId: userId, followerId: { in: followerIds }, status: 'PENDING' },
    data: { status: 'ACCEPTED' },
  });
  await tx.user.update({ where: { id: userId }, data: { followersCount: { increment: count } } });
  await tx.user.updateMany({
    where: { id: { in: followerIds } },
    data: { followingCount: { increment: 1 } },
  });
  return followerIds;
}
