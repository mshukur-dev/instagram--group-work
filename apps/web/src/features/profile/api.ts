import type {
  Me,
  Page,
  Post,
  UpdateProfileInput,
  UserListItem,
  UserProfile,
  ViewerFollowStatus,
} from '@instagram/shared';
import { getMediaSignature } from '@/features/posts/api';
import { api } from '@/lib/api';
import { uploadToCloudinary } from '@/lib/cloudinary-upload';

export type ProfileTab = 'posts' | 'reels' | 'tagged' | 'saved';

export const getMe = () => api.get<Me>('/users/me').then((r) => r.data);

export const getProfile = (username: string) =>
  api.get<UserProfile>(`/users/${username}`).then((r) => r.data);

// Saved posts are always the viewer's own, so they come from /users/me/saved
export const getProfilePosts = (username: string, tab: ProfileTab, cursor?: string) => {
  const url = tab === 'saved' ? '/users/me/saved' : `/users/${username}/${tab}`;
  return api.get<Page<Post>>(url, { params: { cursor } }).then((r) => r.data);
};

export const followUser = (username: string) =>
  api
    .post<{ followStatus: ViewerFollowStatus }>(`/users/${username}/follow`)
    .then((r) => r.data.followStatus);

export const unfollowUser = (username: string) =>
  api.delete(`/users/${username}/follow`).then(() => undefined);

export const updateMe = (input: UpdateProfileInput) =>
  api.patch<Me>('/users/me', input).then((r) => r.data);

// The photo goes straight to Cloudinary (docs/spec/media.md), then the URL is saved on the profile
export async function uploadAvatar(file: File) {
  const signature = await getMediaSignature({ folder: 'avatars' });
  const uploaded = await uploadToCloudinary(file, signature);
  return updateMe({ avatarUrl: uploaded.url });
}

export type FollowListKind = 'followers' | 'following';

export const getFollowList = (username: string, kind: FollowListKind, q: string, cursor?: string) =>
  api
    .get<Page<UserListItem>>(`/users/${username}/${kind}`, {
      params: { cursor, q: q || undefined },
    })
    .then((r) => r.data);

/** FOLLOW-3: removes someone from my followers. */
export const removeFollower = (username: string) =>
  api.delete(`/users/${username}/follower`).then(() => undefined);
