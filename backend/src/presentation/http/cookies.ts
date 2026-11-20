import crypto from 'crypto';
import { CookieOptions, Response } from 'express';

export const ACCESS_COOKIE_NAME = 'kanban_access_token';
export const REFRESH_COOKIE_NAME = 'kanban_refresh_token';
export const CSRF_COOKIE_NAME = 'kanban_csrf_token';

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface CookieConfig {
  secure: boolean;
  sameSite: 'lax' | 'none';
  domain?: string;
}

export function baseCookieOptions(config: CookieConfig): CookieOptions {
  // Browsers reject SameSite=None unless Secure=true
  const secure = config.secure || config.sameSite === 'none';
  return {
    sameSite: config.sameSite,
    secure,
    ...(config.domain ? { domain: config.domain } : {}),
  };
}

export function issueCsrfCookie(res: Response, config: CookieConfig): string {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    ...baseCookieOptions(config),
    httpOnly: false,
    path: '/',
    maxAge: REFRESH_MAX_AGE_MS,
  });
  return csrfToken;
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  config: CookieConfig,
): string {
  const base = baseCookieOptions(config);

  res.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
    ...base,
    httpOnly: true,
    path: '/',
    maxAge: ACCESS_MAX_AGE_MS,
  });

  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    ...base,
    httpOnly: true,
    path: '/api/auth',
    maxAge: REFRESH_MAX_AGE_MS,
  });

  return issueCsrfCookie(res, config);
}

export function clearAuthCookies(res: Response, config: CookieConfig): void {
  const base = baseCookieOptions(config);
  res.clearCookie(ACCESS_COOKIE_NAME, { ...base, httpOnly: true, path: '/' });
  res.clearCookie(REFRESH_COOKIE_NAME, { ...base, httpOnly: true, path: '/api/auth' });
}

export function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const rawVal = part.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(rawVal);
    } catch {
      cookies[key] = rawVal;
    }
  }
  return cookies;
}
