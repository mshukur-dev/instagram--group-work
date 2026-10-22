import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorCode, type Me, type UserProfile, type ViewerFollowStatus } from '@instagram/shared';
import { getErrorCode } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import {
  type FollowListKind,
  followUser,
  getFollowList,
  getMe,
  getProfile,
  getProfilePosts,
  type ProfileTab,
  removeFollower,
  unfollowUser,
  updateMe,
  uploadAvatar,
} from './api';

export const useMe = () => useQuery({ queryKey: queryKeys.me(), queryFn: getMe });

export const useProfile = (username: string) =>
  useQuery({
    queryKey: queryKeys.profile(username),
    queryFn: () => getProfile(username),
    // A missing user stays missing, no point in asking again
    retry: (failureCount, error) =>
      getErrorCode(error) !== ErrorCode.USER_NOT_FOUND && failureCount < 2,
  });

export const useProfilePosts = (username: string, tab: ProfileTab, enabled: boolean) =>
  useInfiniteQuery({
    enabled,
    queryKey: queryKeys.profilePosts(username, tab),
    queryFn: ({ pageParam }) => getProfilePosts(username, tab, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

// New follow status with the followers counter adjusted to match
function withFollowStatus(profile: UserProfile, status: ViewerFollowStatus): UserProfile {
  const before = profile.followStatus === 'ACCEPTED' ? 1 : 0;
  const after = status === 'ACCEPTED' ? 1 : 0;
  return {
    ...profile,
    followStatus: status,
    followersCount: profile.followersCount + after - before,
  };
}

/** `true` follows (or sends a request to a private account), `false` unfollows or cancels the request. */
export const useToggleFollow = (username: string) => {
  const queryClient = useQueryClient();
  const key = queryKeys.profile(username);

  return useMutation({
    mutationFn: (follow: boolean) =>
      follow ? followUser(username) : unfollowUser(username).then(() => 'NONE' as const),
    // Optimistic: the button and the counter change at once, before the server answers
    onMutate: async (follow) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<UserProfile>(key);
      queryClient.setQueryData<UserProfile>(key, (profile) => {
        if (!profile) return profile;
        const guess = !follow ? 'NONE' : profile.isPrivate ? 'PENDING' : 'ACCEPTED';
        return withFollowStatus(profile, guess);
      });
      return { previous };
    },
    onError: (_error, _follow, context) => queryClient.setQueryData(key, context?.previous),
    onSuccess: (status) =>
      queryClient.setQueryData<UserProfile>(key, (profile) =>
        profile ? withFollowStatus(profile, status) : profile,
      ),
    onSettled: () => {
      // Access to a private profile, my "following" counter and the feed may have changed
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed() });
    },
  });
};

function useSaveMe() {
  const queryClient = useQueryClient();
  return (me: Me) => {
    queryClient.setQueryData(queryKeys.me(), me);
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
  };
}

export const useUpdateProfile = () => {
  const onSaved = useSaveMe();
  return useMutation({ mutationFn: updateMe, onSuccess: onSaved });
};

export const useChangeAvatar = () => {
  const onSaved = useSaveMe();
  return useMutation({ mutationFn: uploadAvatar, onSuccess: onSaved });
};

// PROFILE-5: followers / following of one profile, with search; loads more on scroll
export const useFollowList = (username: string, kind: FollowListKind, q: string) =>
  useInfiniteQuery({
    queryKey: queryKeys.followList(username, kind, q),
    queryFn: ({ pageParam }) => getFollowList(username, kind, q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

// Counters, private access and the feed change after any follow action
function useRefreshAfterFollow() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.feed() });
  };
}

/** Follow button inside a list: works for any user, the row keeps its own optimistic status. */
export const useFollowUser = () => {
  const refresh = useRefreshAfterFollow();
  return useMutation({
    mutationFn: ({ username, follow }: { username: string; follow: boolean }) =>
      follow ? followUser(username) : unfollowUser(username).then(() => 'NONE' as const),
    onSettled: refresh,
  });
};

/** FOLLOW-3: remove a follower from my own followers list. */
export const useRemoveFollower = () => {
  const refresh = useRefreshAfterFollow();
  return useMutation({ mutationFn: removeFollower, onSettled: refresh });
};
