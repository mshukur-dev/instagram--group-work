import { AppException } from '../../common/errors/app-exception';
import type { PrismaService } from '../../prisma/prisma.service';
import type { FollowsService } from '../follows/follows.service';
import type { MediaService } from '../media/media.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { UserPreviewService } from '../users/user-preview.service';
import { PostsService } from './posts.service';

type Setup = { post: { authorId: string } | null; canView: boolean; blocked: boolean };

function makeService({ post, canView, blocked }: Setup): PostsService {
  const prisma = {
    post: {
      findUnique: jest.fn().mockResolvedValue(
        post ? { id: 'p1', type: 'POST', commentsDisabled: false, ...post } : null,
      ),
    },
  } as unknown as PrismaService;
  const follows = {
    canViewContent: jest.fn().mockResolvedValue(canView),
    isBlockedBetween: jest.fn().mockResolvedValue(blocked),
  } as unknown as FollowsService;
  return new PostsService(
    prisma,
    follows,
    {} as UserPreviewService,
    {} as MediaService,
    {} as NotificationsService,
  );
}

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (e) {
    return e instanceof AppException ? e.code : 'other';
  }
  return undefined;
}

describe('PostsService.getAccessible', () => {
  it('returns visible posts', async () => {
    const service = makeService({ post: { authorId: 'a' }, canView: true, blocked: false });
    await expect(service.getAccessible('v', 'p1')).resolves.toMatchObject({ id: 'p1' });
  });

  it('404 POST_NOT_FOUND for missing posts', async () => {
    const service = makeService({ post: null, canView: true, blocked: false });
    expect(await errorCode(service.getAccessible('v', 'p1'))).toBe('POST_NOT_FOUND');
  });

  it('404 POST_NOT_FOUND when a block hides the post', async () => {
    const service = makeService({ post: { authorId: 'a' }, canView: false, blocked: true });
    expect(await errorCode(service.getAccessible('v', 'p1'))).toBe('POST_NOT_FOUND');
  });

  it('403 PRIVATE_ACCOUNT for private accounts the viewer does not follow', async () => {
    const service = makeService({ post: { authorId: 'a' }, canView: false, blocked: false });
    expect(await errorCode(service.getAccessible('v', 'p1'))).toBe('PRIVATE_ACCOUNT');
  });
});
