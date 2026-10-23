import type {
  Me,
  Settings,
  UpdateNotificationSettingsInput,
  UpdateSettingsInput,
  UserPreview,
} from '@instagram/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';
import { applyTheme } from '@/lib/theme';
import {
  changePassword,
  createHighlight,
  getBlocked,
  getSessions,
  getSettings,
  getStoryArchive,
  logoutOtherSessions,
  logoutSession,
  unblockUser,
  updateNotificationSettings,
  updateSettings,
} from './api';

export const useSettings = () => useQuery({ queryKey: queryKeys.settings(), queryFn: getSettings });

// Switches answer at once and go back if the server says no
function useSettingsMutation<Input>(
  mutationFn: (input: Input) => Promise<Settings>,
  patch: (settings: Settings, input: Input) => Settings,
  /** Runs at once even when the settings aren't loaded yet (theme from the More menu) */
  onStart?: (input: Input) => void,
) {
  const queryClient = useQueryClient();
  const t = useTranslations('settings');
  return useMutation({
    mutationFn,
    onMutate: (input: Input) => {
      onStart?.(input);
      const before = queryClient.getQueryData<Settings>(queryKeys.settings());
      if (before) queryClient.setQueryData(queryKeys.settings(), patch(before, input));
      return { before };
    },
    onError: (_error, _input, context) => {
      if (context?.before) queryClient.setQueryData(queryKeys.settings(), context.before);
      toast.error(t('saveFailed'));
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.settings(), settings);
      // `Me` carries some of the same fields (private account, theme, language)
      queryClient.setQueryData<Me>(queryKeys.me(), (me) =>
        me
          ? {
              ...me,
              isPrivate: settings.isPrivate,
              theme: settings.theme,
              language: settings.language,
            }
          : me,
      );
    },
  });
}

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useSettingsMutation(
    updateSettings,
    (settings, input: UpdateSettingsInput) => ({ ...settings, ...input }),
    ({ theme }) => {
      if (!theme) return;
      applyTheme(theme);
      // The More menu reads the theme from `Me`, which may be the only thing loaded
      queryClient.setQueryData<Me>(queryKeys.me(), (me) => (me ? { ...me, theme } : me));
    },
  );
};

export const useUpdateNotificationSettings = () =>
  useSettingsMutation(
    updateNotificationSettings,
    (settings, { pauseHours, ...rest }: UpdateNotificationSettingsInput) => {
      const pausedUntil =
        pauseHours === undefined
          ? settings.notifications.pausedUntil
          : pauseHours === 0
            ? null
            : new Date(Date.now() + pauseHours * 3_600_000).toISOString();
      return { ...settings, notifications: { ...settings.notifications, ...rest, pausedUntil } };
    },
  );

export const useSessions = () => useQuery({ queryKey: queryKeys.sessions(), queryFn: getSessions });

export const useLogoutSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logoutSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions() }),
  });
};

export const useLogoutOtherSessions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logoutOtherSessions,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions() }),
  });
};

export const useChangePassword = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      // A Google account now has a password too; other sessions were logged out
      queryClient.setQueryData<Settings>(queryKeys.settings(), (s) =>
        s ? { ...s, hasPassword: true } : s,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions() });
    },
  });
};

export const useBlocked = () => useQuery({ queryKey: queryKeys.blocked(), queryFn: getBlocked });

export const useUnblock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: UserPreview) => unblockUser(user.username),
    onSuccess: (_result, user) => {
      queryClient.setQueryData<UserPreview[]>(queryKeys.blocked(), (users) =>
        users?.filter((u) => u.id !== user.id),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.username) });
    },
  });
};

export const useStoryArchive = () =>
  useInfiniteQuery({
    queryKey: queryKeys.storyArchive(),
    queryFn: ({ pageParam }) => getStoryArchive(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useCreateHighlight = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createHighlight,
    // Profiles show highlights; refresh them
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['highlights'] }),
  });
};
