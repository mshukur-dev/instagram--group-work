import type { User } from '@prisma/client';
import type { UserListItem, UserPreview, UserProfile, ViewerFollowStatus } from '@instagram/shared';

export function toUserListItem(
  preview: UserPreview,
  followStatus: ViewerFollowStatus,
  viewerId: string,
): UserListItem {
  return { ...preview, followStatus, isMe: preview.id === viewerId };
}

export type ProfileRelation = {
  isMe: boolean;
  followStatus: ViewerFollowStatus;
  followsMe: boolean;
  /** The viewer blocked this user */
  isBlocked: boolean;
  canViewContent: boolean;
};

export function toUserProfile(
  user: Pick<
    User,
    'bio' | 'website' | 'isPrivate' | 'postsCount' | 'followersCount' | 'followingCount'
  >,
  preview: UserPreview,
  relation: ProfileRelation,
): UserProfile {
  // Story ring is hidden when the viewer can't open the stories anyway
  const storyState = relation.canViewContent
    ? { hasActiveStory: preview.hasActiveStory, hasUnseenStory: preview.hasUnseenStory }
    : { hasActiveStory: false, hasUnseenStory: false };
  return {
    ...preview,
    ...storyState,
    bio: user.bio,
    website: user.website,
    isPrivate: user.isPrivate,
    postsCount: user.postsCount,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    ...relation,
  };
}
