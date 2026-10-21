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
let refreshing: Promise<void> | null = null;
const refreshTokens = () =>
  (refreshing ??= api
    .post('/auth/refresh')
    .then(() => undefined)
    .finally(() => {
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
