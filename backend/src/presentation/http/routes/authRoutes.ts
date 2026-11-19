import { RequestHandler, Router } from 'express';
import { loginSchema, registerSchema } from '../../validation/authSchemas';
import { AuthController } from '../controllers/AuthController';
import { asyncHandler } from '../middlewares/asyncHandler';
import { AuthRateLimiters } from '../middlewares/rateLimitMiddleware';
import { validateBody } from '../middlewares/validateBody';

export function createAuthRoutes(
  controller: AuthController,
  cookieAuthMiddleware: RequestHandler,
  rateLimiters: AuthRateLimiters,
): Router {
  const router = Router();

  router.get('/csrf', controller.csrf);
  router.post(
    '/register',
    rateLimiters.registerLimiter,
    validateBody(registerSchema),
    asyncHandler(controller.register),
  );
  router.post(
    '/login',
    rateLimiters.loginLimiter,
    validateBody(loginSchema),
    asyncHandler(controller.login),
  );
  router.post('/refresh', rateLimiters.refreshLimiter, asyncHandler(controller.refresh));
  router.post('/logout', asyncHandler(controller.logout));
  router.get('/me', cookieAuthMiddleware, asyncHandler(controller.me));

  return router;
}
