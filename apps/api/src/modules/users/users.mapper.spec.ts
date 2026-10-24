import type { UserPreview } from '@instagram/shared';
import { toUserListItem, toUserProfile } from './users.mapper';

const preview: UserPreview = {
  id: 'u1',
  username: 'emma',
  fullName: 'Emma',
  avatarUrl: null,
  isVerified: false,
  hasActiveStory: true,
  hasUnseenStory: true,
};
const counters = {
  bio: null,
  website: null,
  isPrivate: true,
  postsCount: 3,
  followersCount: 10,
  followingCount: 5,
};

describe('users mapper', () => {
  it('hides the story ring when the viewer cannot see content', () => {
    const profile = toUserProfile(counters, preview, {
      isMe: false,
      followStatus: 'PENDING',
      followsMe: false,
      isBlocked: false,
      canViewContent: false,
    });
    expect(profile).toMatchObject({
      hasActiveStory: false,
      hasUnseenStory: false,
      followStatus: 'PENDING',
      postsCount: 3,
    });
  });

  it('keeps the story ring for followers', () => {
    const profile = toUserProfile(counters, preview, {
      isMe: false,
      followStatus: 'ACCEPTED',
      followsMe: true,
      isBlocked: false,
      canViewContent: true,
    });
    expect(profile.hasActiveStory).toBe(true);
  });

  it('marks the viewer in lists', () => {
    expect(toUserListItem(preview, 'NONE', 'u1').isMe).toBe(true);
    expect(toUserListItem(preview, 'ACCEPTED', 'u2')).toMatchObject({
      isMe: false,
      followStatus: 'ACCEPTED',
    });
  });
});
