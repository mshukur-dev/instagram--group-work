import type { CookieOptions, Response } from 'express';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SOCKET_TTL_SECONDS = 60;

// Refresh cookie is only sent to auth endpoints (see docs/spec/auth.md)
const REFRESH_PATH = '/api/auth';

function baseOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  secure: boolean,
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(secure),
    path: '/',
    maxAge: ACCESS_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(secure),
    path: REFRESH_PATH,
    maxAge: REFRESH_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response, secure: boolean): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(secure), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(secure), path: REFRESH_PATH });
}
