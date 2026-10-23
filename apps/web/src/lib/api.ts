import axios, { isAxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getQueryClient } from './query-client';

// Same-origin requests: Next.js rewrites /api/* to the NestJS API.
export const api = axios.create({ baseURL: '/api', withCredentials: true });

// A 401 on these means "wrong credentials / dead session", not "access token expired"
const NO_REFRESH_URLS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];
const PUBLIC_PAGES = ['/accounts/login', '/accounts/emailsignup'];

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// Parallel requests that all got 401 share one refresh call: refresh tokens rotate,
// a second call with the old token would be treated as theft and kill the session.
// The same goes for several open tabs (they share the cookies): a Web Lock lets one tab refresh
// at a time, and a tab that waited behind a fresh refresh just retries with the new cookies.
const LAST_REFRESH_KEY = 'auth:lastRefreshAt';
const FRESH_MS = 10_000;

const readLastRefresh = () => {
  try {
    return Number(localStorage.getItem(LAST_REFRESH_KEY) ?? 0);
  } catch {
    return 0;
  }
};

const refreshOnce = async () => {
  if (Date.now() - readLastRefresh() < FRESH_MS) return; // another tab just did it
  await api.post('/auth/refresh');
  try {
    localStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
  } catch {
    // private mode: nothing to share with other tabs
  }
};

let refreshing: Promise<void> | null = null;
const refreshTokens = () =>
  (refreshing ??= (
    typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('auth-refresh', () => refreshOnce()).then(() => undefined)
      : refreshOnce()
  ).finally(() => {
    refreshing = null;
  }));

function onSessionExpired() {
  getQueryClient().clear();
  if (!PUBLIC_PAGES.includes(window.location.pathname)) {
    window.location.assign('/accounts/login');
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error) || error.response?.status !== 401 || !error.config) throw error;

    const original = error.config as RetryableConfig;
    if (original._retried || NO_REFRESH_URLS.includes(original.url ?? '')) throw error;
    original._retried = true;

    try {
      await refreshTokens();
    } catch {
      onSessionExpired();
      throw error;
    }
    return api(original);
  },
);
