import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { Me } from '@instagram/shared';
import { queryKeys } from '@/lib/query-keys';
import { disablePushHere } from '@/features/push/push';
import { changeUsername, login, logout, register } from './api';

const LOCALE_COOKIE = 'NEXT_LOCALE';

// The account language wins over the browser cookie (docs/spec/i18n.md)
function syncLocale(me: Me) {
  const locale = me.language.toLowerCase();
  if (document.cookie.includes(`${LOCALE_COOKIE}=${locale}`)) return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/** Shared by login and register: put `Me` into the cache and open the app. */
function useSignedIn(to: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return (me: Me) => {
    syncLocale(me);
    queryClient.setQueryData(queryKeys.me(), me);
    router.replace(to);
    router.refresh();
  };
}

export const useLogin = () => {
  const onSignedIn = useSignedIn('/');
  return useMutation({ mutationFn: login, onSuccess: onSignedIn });
};

export const useRegister = () => {
  const onSignedIn = useSignedIn('/');
  return useMutation({ mutationFn: register, onSuccess: onSignedIn });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    // This browser stops getting the account's pushes first, while still signed in
    mutationFn: async () => {
      await disablePushHere();
      await logout();
    },
    onSettled: () => {
      // Hard navigation drops every in-memory state of the previous account
      queryClient.clear();
      window.location.assign('/accounts/login');
    },
  });
};

export const useChangeUsername = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: changeUsername,
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.me(), me);
      router.replace('/');
    },
  });
};
