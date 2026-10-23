import { ErrorCode } from '@instagram/shared';
import { AppException } from '../../common/errors/app-exception';
import type { PrismaService } from '../../prisma/prisma.service';
import type { FollowsService } from '../follows/follows.service';
import { MembersService } from './members.service';

describe('MembersService', () => {
  const findUnique = jest.fn();
  const findFirst = jest.fn();
  const isBlockedBetween = jest.fn();
  const prisma = { conversationMember: { findUnique, findFirst } } as unknown as PrismaService;
  const follows = { isBlockedBetween } as unknown as FollowsService;
  const service = new MembersService(prisma, follows);

  const codeOf = async (promise: Promise<unknown>) => {
    try {
      await promise;
      return null;
    } catch (error) {
      return error instanceof AppException ? error.code : 'other';
    }
  };

  beforeEach(() => jest.resetAllMocks());

  it('404 for strangers, 403 for former members', async () => {
    findUnique.mockResolvedValueOnce(null);
    expect(await codeOf(service.requireMember('u1', 'c1'))).toBe(ErrorCode.CONVERSATION_NOT_FOUND);

    findUnique.mockResolvedValueOnce({
      role: 'MEMBER',
      leftAt: new Date(),
      conversation: { isGroup: true },
    });
    expect(await codeOf(service.requireMember('u1', 'c1'))).toBe(ErrorCode.NOT_A_MEMBER);

    findUnique.mockResolvedValueOnce({
      role: 'ADMIN',
      leftAt: null,
      conversation: { isGroup: true },
    });
    await expect(service.requireMember('u1', 'c1')).resolves.toEqual({
      conversationId: 'c1',
      isGroup: true,
      role: 'ADMIN',
    });
  });

  it('blocks only matter in 1:1 chats', async () => {
    await service.assertNotBlocked('u1', {
      conversationId: 'g1',
      isGroup: true,
      role: 'MEMBER',
      clearedAt: null,
    });
    expect(findFirst).not.toHaveBeenCalled();

    findFirst.mockResolvedValueOnce({ userId: 'u2' });
    isBlockedBetween.mockResolvedValueOnce(true);
    const membership = {
      conversationId: 'c1',
      isGroup: false,
      role: 'MEMBER' as const,
      clearedAt: null,
    };
    expect(await codeOf(service.assertNotBlocked('u1', membership))).toBe(
      ErrorCode.MESSAGING_NOT_ALLOWED,
    );
  });
});
