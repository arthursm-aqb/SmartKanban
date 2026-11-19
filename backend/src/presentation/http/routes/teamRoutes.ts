import { RequestHandler, Router } from 'express';
import { createTeamSchema, joinTeamSchema } from '../../validation/teamSchemas';
import { TeamController } from '../controllers/TeamController';
import { asyncHandler } from '../middlewares/asyncHandler';
import { uploadContextDocumentMiddleware } from '../middlewares/uploadMiddleware';
import { validateBody } from '../middlewares/validateBody';

export function createTeamRoutes(
  controller: TeamController,
  cookieAuthMiddleware: RequestHandler,
): Router {
  const router = Router();

  router.use(cookieAuthMiddleware);

  router.get('/', asyncHandler(controller.list));
  router.post(
    '/',
    ...uploadContextDocumentMiddleware,
    validateBody(createTeamSchema),
    asyncHandler(controller.create),
  );
  router.post('/join', validateBody(joinTeamSchema), asyncHandler(controller.join));

  return router;
}
