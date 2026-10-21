import type { User } from '@prisma/client';
import { AppException } from '../../common/errors/app-exception';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { UserPreviewService } from '../users/user-preview.service';
import type { UsersService } from '../users/users.service';
import { FollowActionsService } from './follow-actions.service';
import type { FollowsService } from './follows.service';

const target = { id: 'target', username: 'target', isPrivate: false } as User;

function setup(opts: { isPrivate?: boolean; blocked?: boolean; existing?: unknown } = {}) {
  const tx = {
    follow: {
      findUnique: jest.fn().mockResolvedValue(opts.existing ?? null),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const users = {
    findByUsernameOrThrow: jest
      .fn()
      .mockResolvedValue({ ...target, isPrivate: opts.isPrivate ?? false }),
  };
  const follows = { isBlockedBetween: jest.fn().mockResolvedValue(opts.blocked ?? false) };
  const notifications = { create: jest.fn(), remove: jest.fn() };
  const service = new FollowActionsService(
    prisma as unknown as PrismaService,
    follows as unknown as FollowsService,
    users as unknown as UsersService,
    {} as UserPreviewService,
    notifications as unknown as NotificationsService,
  );
  return { service, tx, notifications };
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof AppException) return e.code;
    throw e;
  }
  return undefined;
}

describe('FollowActionsService.follow', () => {
  it('follows a public account right away and notifies FOLLOW', async () => {
    const { service, tx, notifications } = setup();
    await expect(service.follow('me', 'target')).resolves.toEqual({ followStatus: 'ACCEPTED' });
    expect(tx.user.update).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledWith({
      recipientId: 'target',
      actorId: 'me',
      type: 'FOLLOW',
    });
  });

  it('sends a request to a private account without changing counters', async () => {
    const { service, tx, notifications } = setup({ isPrivate: true });
    await expect(service.follow('me', 'target')).resolves.toEqual({ followStatus: 'PENDING' });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'FOLLOW_REQUEST' }),
    );
  });

  it('is idempotent: a repeated follow returns the current status without notifying', async () => {
    const { service, tx, notifications } = setup({ existing: { status: 'PENDING' } });
    await expect(service.follow('me', 'target')).resolves.toEqual({ followStatus: 'PENDING' });
    expect(tx.follow.createMany).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('rejects following yourself and blocked users', async () => {
    await expect(codeOf(setup().service.follow('target', 'target'))).resolves.toBe(
      'CANNOT_FOLLOW_SELF',
    );
    await expect(codeOf(setup({ blocked: true }).service.follow('me', 'target'))).resolves.toBe(
      'USER_NOT_FOUND',
    );
  });
});
