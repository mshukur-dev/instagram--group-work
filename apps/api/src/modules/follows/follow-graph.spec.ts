import type { Prisma } from '@prisma/client';
import { acceptAllPendingTx, acceptFollowTx, removeFollowTx } from './follow-graph';

function mockTx(overrides: {
  findUnique?: unknown;
  deleteCount?: number;
  updateCount?: number;
  pending?: { followerId: string }[];
}) {
  const tx = {
    follow: {
      findUnique: jest.fn().mockResolvedValue(overrides.findUnique ?? null),
      deleteMany: jest.fn().mockResolvedValue({ count: overrides.deleteCount ?? 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: overrides.updateCount ?? 1 }),
      findMany: jest.fn().mockResolvedValue(overrides.pending ?? []),
    },
    user: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  return { tx, client: tx as unknown as Prisma.TransactionClient };
}

describe('follow graph counters', () => {
  it('decrements both counters when an accepted follow is removed', async () => {
    const { tx, client } = mockTx({ findUnique: { status: 'ACCEPTED' } });
    await expect(removeFollowTx(client, 'a', 'b')).resolves.toBe('ACCEPTED');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { followingCount: { decrement: 1 } },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { followersCount: { decrement: 1 } },
    });
  });

  it('does not touch counters when a pending request is cancelled', async () => {
    const { tx, client } = mockTx({ findUnique: { status: 'PENDING' } });
    await expect(removeFollowTx(client, 'a', 'b')).resolves.toBe('PENDING');
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('returns null when there is nothing to remove or it was removed concurrently', async () => {
    await expect(removeFollowTx(mockTx({}).client, 'a', 'b')).resolves.toBeNull();
    const { tx, client } = mockTx({ findUnique: { status: 'ACCEPTED' }, deleteCount: 0 });
    await expect(removeFollowTx(client, 'a', 'b')).resolves.toBeNull();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('accepts a request with counters, or reports that none exists', async () => {
    const ok = mockTx({ updateCount: 1 });
    await expect(acceptFollowTx(ok.client, 'a', 'b')).resolves.toBe(true);
    expect(ok.tx.user.update).toHaveBeenCalledTimes(2);

    const none = mockTx({ updateCount: 0 });
    await expect(acceptFollowTx(none.client, 'a', 'b')).resolves.toBe(false);
    expect(none.tx.user.update).not.toHaveBeenCalled();
  });

  it('accepts all pending requests when the account becomes public', async () => {
    const { tx, client } = mockTx({
      pending: [{ followerId: 'x' }, { followerId: 'y' }],
      updateCount: 2,
    });
    await expect(acceptAllPendingTx(client, 'me')).resolves.toEqual(['x', 'y']);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'me' },
      data: { followersCount: { increment: 2 } },
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['x', 'y'] } },
      data: { followingCount: { increment: 1 } },
    });
  });
});
