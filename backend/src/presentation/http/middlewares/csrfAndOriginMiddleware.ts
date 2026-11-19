import crypto from 'crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ForbiddenError } from '../../../domain/errors';
import { CSRF_COOKIE_NAME } from '../cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function timingSafeStringEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Protects all mutating HTTP requests against CSRF:
 * 1. Rejects cross-origin requests whose Origin or Referer does not match FRONTEND_ORIGIN.
 * 2. Requires Double Submit Cookie (cookie `kanban_csrf_token` === header `X-CSRF-Token`).
 */
export function createCsrfAndOriginMiddleware(allowedOrigin: string): RequestHandler {
  const normalizedAllowedOrigin = allowedOrigin.replace(/\/+$/, '');

  return (req: Request, _res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    const originHeader = req.headers.origin;
    if (typeof originHeader === 'string' && originHeader.length > 0) {
      if (originHeader.replace(/\/+$/, '') !== normalizedAllowedOrigin) {
        next(new ForbiddenError('Origem da requisição não autorizada (proteção CSRF).'));
        return;
      }
    } else if (typeof req.headers.referer === 'string' && req.headers.referer.length > 0) {
      try {
        const refererOrigin = new URL(req.headers.referer).origin;
        if (refererOrigin !== normalizedAllowedOrigin) {
          next(new ForbiddenError('Referer da requisição não autorizado (proteção CSRF).'));
          return;
        }
      } catch {
        next(new ForbiddenError('Cabeçalho Referer inválido.'));
        return;
      }
    }

    const cookieCsrf = req.cookies?.[CSRF_COOKIE_NAME];
    const headerCsrf = req.headers['x-csrf-token'];

    if (
      typeof cookieCsrf !== 'string' ||
      cookieCsrf.length < 16 ||
      typeof headerCsrf !== 'string' ||
      !timingSafeStringEquals(cookieCsrf, headerCsrf)
    ) {
      next(
        new ForbiddenError(
          'Token anti-CSRF ausente ou inválido. Obtenha o token em GET /api/auth/csrf e envie em X-CSRF-Token.',
        ),
      );
      return;
    }

    next();
  };
}
