import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ITokenService } from '../../../application/ports/services/ITokenService';
import { UnauthorizedError } from '../../../domain/errors';
import { ACCESS_COOKIE_NAME } from '../cookies';

export interface AuthenticatedHttpUser {
  id: string;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedHttpUser;
    }
  }
}

export function createCookieAuthMiddleware(tokenService: ITokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const rawAccessToken = req.cookies?.[ACCESS_COOKIE_NAME];
    if (typeof rawAccessToken !== 'string' || rawAccessToken.length === 0) {
      next(new UnauthorizedError('Sessão ausente. Faça login para continuar.'));
      return;
    }

    try {
      const payload = tokenService.verifyAccessToken(rawAccessToken);
      req.authUser = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
      };
      next();
    } catch {
      next(new UnauthorizedError('Token de acesso inválido ou expirado.'));
    }
  };
}
