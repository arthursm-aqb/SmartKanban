import http from 'http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import { Server as SocketIoServer } from 'socket.io';
import { createCookieAuthMiddleware } from '../presentation/http/middlewares/cookieAuthMiddleware';
import { createCsrfAndOriginMiddleware } from '../presentation/http/middlewares/csrfAndOriginMiddleware';
import { errorHandlerMiddleware } from '../presentation/http/middlewares/errorHandlerMiddleware';
import { createAuthRateLimiters } from '../presentation/http/middlewares/rateLimitMiddleware';
import { createAuthRoutes } from '../presentation/http/routes/authRoutes';
import { createTeamRoutes } from '../presentation/http/routes/teamRoutes';
import { attachSocketServer } from '../presentation/websocket/socketServer';
import { AppContainer } from './container';

export interface CreatedApp {
  app: Express;
  httpServer: http.Server;
  io: SocketIoServer;
}

export function createApp(container: AppContainer): CreatedApp {
  const app = express();
  const normalizedOrigin = container.frontendOrigin.replace(/\/+$/, '');

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: normalizedOrigin,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Protect all mutating HTTP routes with Origin + Double Submit CSRF verification
  app.use('/api', createCsrfAndOriginMiddleware(normalizedOrigin));

  const cookieAuth = createCookieAuthMiddleware(container.tokenService);
  const authRateLimiters = createAuthRateLimiters(container.authRateLimitOptions);

  app.use('/api/auth', createAuthRoutes(container.authController, cookieAuth, authRateLimiters));
  app.use('/api/teams', createTeamRoutes(container.teamController, cookieAuth));

  app.use(errorHandlerMiddleware);

  const httpServer = http.createServer(app);
  const io = attachSocketServer(httpServer, {
    allowedOrigin: normalizedOrigin,
    tokenService: container.tokenService,
    rateLimiter: container.rateLimiter,
    realtimePublisher: container.realtimePublisher,
    getBoardSnapshotUseCase: container.useCases.getBoardSnapshot,
    updateColumnWipUseCase: container.useCases.updateColumnWip,
    createStoryUseCase: container.useCases.createStory,
    updateStoryUseCase: container.useCases.updateStory,
    moveStoryUseCase: container.useCases.moveStory,
    deleteStoryUseCase: container.useCases.deleteStory,
    generateAndPrioritizeTasksUseCase: container.useCases.generateAndPrioritizeTasks,
    reprioritizeStoryTasksUseCase: container.useCases.reprioritizeStoryTasks,
    updateTaskUseCase: container.useCases.updateTask,
    moveTaskUseCase: container.useCases.moveTask,
    deleteTaskUseCase: container.useCases.deleteTask,
    createStickyNoteUseCase: container.useCases.createStickyNote,
    updateStickyNoteUseCase: container.useCases.updateStickyNote,
    deleteStickyNoteUseCase: container.useCases.deleteStickyNote,
    listActivityLogsUseCase: container.useCases.listActivityLogs,
  });

  return { app, httpServer, io };
}
