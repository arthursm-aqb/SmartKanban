import { Server as HttpServer } from 'http';
import { Server as SocketIoServer } from 'socket.io';
import { IRateLimiter } from '../../application/ports/services/IRateLimiter';
import { ITokenService } from '../../application/ports/services/ITokenService';
import { ListActivityLogsUseCase } from '../../application/use-cases/activity/ListActivityLogsUseCase';
import { GetBoardSnapshotUseCase } from '../../application/use-cases/board/GetBoardSnapshotUseCase';
import { UpdateColumnWipUseCase } from '../../application/use-cases/board/UpdateColumnWipUseCase';
import { CreateStickyNoteUseCase } from '../../application/use-cases/notes/CreateStickyNoteUseCase';
import { DeleteStickyNoteUseCase } from '../../application/use-cases/notes/DeleteStickyNoteUseCase';
import { UpdateStickyNoteUseCase } from '../../application/use-cases/notes/UpdateStickyNoteUseCase';
import { CreateStoryUseCase } from '../../application/use-cases/stories/CreateStoryUseCase';
import { DeleteStoryUseCase } from '../../application/use-cases/stories/DeleteStoryUseCase';
import { MoveStoryUseCase } from '../../application/use-cases/stories/MoveStoryUseCase';
import { UpdateStoryUseCase } from '../../application/use-cases/stories/UpdateStoryUseCase';
import { DeleteTaskUseCase } from '../../application/use-cases/tasks/DeleteTaskUseCase';
import { GenerateAndPrioritizeTasksUseCase } from '../../application/use-cases/tasks/GenerateAndPrioritizeTasksUseCase';
import { MoveTaskUseCase } from '../../application/use-cases/tasks/MoveTaskUseCase';
import { ReprioritizeStoryTasksUseCase } from '../../application/use-cases/tasks/ReprioritizeStoryTasksUseCase';
import { UpdateTaskUseCase } from '../../application/use-cases/tasks/UpdateTaskUseCase';
import { SocketIoRealtimePublisher } from '../../infrastructure/realtime/SocketIoRealtimePublisher';
import { ACCESS_COOKIE_NAME, parseCookieHeader } from '../http/cookies';
import {
  activityListSchema,
  boardJoinSchema,
  boardUpdateWipSchema,
  noteCreateSchema,
  noteDeleteSchema,
  noteUpdateSchema,
  storyCreateSchema,
  storyDeleteSchema,
  storyGenerateTasksSchema,
  storyMoveSchema,
  storyUpdateSchema,
  taskDeleteSchema,
  taskMoveSchema,
  taskReprioritizeSchema,
  taskUpdateSchema,
} from '../validation/socketEventSchemas';
import {
  AuthenticatedSocket,
  registerSocketHandler,
  SocketAuthUser,
} from './defineSocketHandler';

export interface SocketServerDeps {
  allowedOrigin: string;
  tokenService: ITokenService;
  rateLimiter: IRateLimiter;
  realtimePublisher: SocketIoRealtimePublisher;
  getBoardSnapshotUseCase: GetBoardSnapshotUseCase;
  updateColumnWipUseCase: UpdateColumnWipUseCase;
  createStoryUseCase: CreateStoryUseCase;
  updateStoryUseCase: UpdateStoryUseCase;
  moveStoryUseCase: MoveStoryUseCase;
  deleteStoryUseCase: DeleteStoryUseCase;
  generateAndPrioritizeTasksUseCase: GenerateAndPrioritizeTasksUseCase;
  reprioritizeStoryTasksUseCase: ReprioritizeStoryTasksUseCase;
  updateTaskUseCase: UpdateTaskUseCase;
  moveTaskUseCase: MoveTaskUseCase;
  deleteTaskUseCase: DeleteTaskUseCase;
  createStickyNoteUseCase: CreateStickyNoteUseCase;
  updateStickyNoteUseCase: UpdateStickyNoteUseCase;
  deleteStickyNoteUseCase: DeleteStickyNoteUseCase;
  listActivityLogsUseCase: ListActivityLogsUseCase;
}

const AI_THROTTLE_MAX = 5;
const AI_THROTTLE_WINDOW_MS = 60 * 1000;

export function attachSocketServer(httpServer: HttpServer, deps: SocketServerDeps): SocketIoServer {
  const normalizedAllowedOrigin = deps.allowedOrigin.replace(/\/+$/, '');

  const io = new SocketIoServer(httpServer, {
    cors: {
      origin: normalizedAllowedOrigin,
      credentials: true,
    },
  });

  deps.realtimePublisher.bindServer(io);

  // Presence tracking: boardId -> Map<socketId, SocketAuthUser>
  const boardPresence = new Map<string, Map<string, SocketAuthUser>>();

  function broadcastPresence(boardId: string): void {
    const roomSockets = boardPresence.get(boardId);
    const uniqueUsers = new Map<string, SocketAuthUser>();
    if (roomSockets) {
      for (const user of roomSockets.values()) {
        uniqueUsers.set(user.id, user);
      }
    }
    deps.realtimePublisher.publishToBoard(boardId, 'board:presence_updated', {
      users: Array.from(uniqueUsers.values()),
    });
  }

  function removeSocketFromBoard(socket: AuthenticatedSocket): void {
    const prevBoardId = socket.data.boardId;
    if (!prevBoardId) return;

    void socket.leave(`board:${prevBoardId}`);
    const roomMap = boardPresence.get(prevBoardId);
    if (roomMap) {
      roomMap.delete(socket.id);
      if (roomMap.size === 0) {
        boardPresence.delete(prevBoardId);
      }
    }
    socket.data.boardId = undefined;
    broadcastPresence(prevBoardId);
  }

  // Handshake middleware: strict Origin check + HttpOnly Access Token JWT validation
  io.use((socket, next) => {
    const originHeader = socket.handshake.headers.origin;
    if (
      typeof originHeader === 'string' &&
      originHeader.length > 0 &&
      originHeader.replace(/\/+$/, '') !== normalizedAllowedOrigin
    ) {
      next(new Error('ORIGIN_NOT_ALLOWED'));
      return;
    }

    const cookies = parseCookieHeader(socket.handshake.headers.cookie);
    const accessToken = cookies[ACCESS_COOKIE_NAME];
    if (!accessToken) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    try {
      const payload = deps.tokenService.verifyAccessToken(accessToken);
      socket.data.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
      };
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'board:join',
      schema: boardJoinSchema,
      requireJoinedBoard: false,
      handler: async (input, s) => {
        const snapshot = await deps.getBoardSnapshotUseCase.execute(
          input.boardId,
          s.data.user.id,
        );

        if (s.data.boardId && s.data.boardId !== input.boardId) {
          removeSocketFromBoard(s);
        }

        s.data.boardId = input.boardId;
        await s.join(`board:${input.boardId}`);

        let roomMap = boardPresence.get(input.boardId);
        if (!roomMap) {
          roomMap = new Map();
          boardPresence.set(input.boardId, roomMap);
        }
        roomMap.set(s.id, s.data.user);
        broadcastPresence(input.boardId);

        const onlineUsers = Array.from(
          new Map(Array.from(roomMap.values()).map((u) => [u.id, u])).values(),
        );

        return { ...snapshot, onlineUsers };
      },
    });

    socket.on('board:leave', () => {
      removeSocketFromBoard(socket);
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'board:update_wip',
      schema: boardUpdateWipSchema,
      handler: async (input, s) =>
        deps.updateColumnWipUseCase.execute({
          boardId: s.data.boardId!,
          actorId: s.data.user.id,
          columnType: input.columnType,
          wipLimit: input.wipLimit,
        }),
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'story:create',
      schema: storyCreateSchema,
      handler: async (input, s) =>
        deps.createStoryUseCase.execute({
          boardId: s.data.boardId!,
          actorId: s.data.user.id,
          title: input.title,
          description: input.description,
        }),
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'story:update',
      schema: storyUpdateSchema,
      handler: async (input, s) =>
        deps.updateStoryUseCase.execute({
          boardId: s.data.boardId!,
          actorId: s.data.user.id,
          storyId: input.storyId,
          title: input.title,
          description: input.description,
        }),
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'story:move',
      schema: storyMoveSchema,
      handler: async (input, s) =>
        deps.moveStoryUseCase.execute({
          boardId: s.data.boardId!,
          actorId: s.data.user.id,
          storyId: input.storyId,
          toSubcolumn: input.toSubcolumn,
          position: input.position,
        }),
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'story:delete',
      schema: storyDeleteSchema,
      handler: async (input, s) =>
        deps.deleteStoryUseCase.execute({
          boardId: s.data.boardId!,
          actorId: s.data.user.id,
          storyId: input.storyId,
        }),
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'story:generate_tasks',
      schema: storyGenerateTasksSchema,
      customRateLimit: {
        scope: 'user',
        maxRequests: AI_THROTTLE_MAX,
        windowMs: AI_THROTTLE_WINDOW_MS,
      },
      handler: async (input, s) =>
        deps.generateAndPrioritizeTasksUseCase.execute({
          boardId: s.data.boardId!,
          actorId: s.data.user.id,
          storyId: input.storyId,
          tasks: input.tasks,
        }),
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'task:reprioritize',
      schema: taskReprioritizeSchema,
      customRateLimit: {
        scope: 'user',
        maxRequests: AI_THROTTLE_MAX,
        windowMs: AI_THROTTLE_WINDOW_MS,
      },
      handler: async (input, s) =>
        deps.reprioritizeStoryTasksUseCase.execute({
          boardId: s.data.boardId!,
          actorId: s.data.user.id,
          storyId: input.storyId,
        }),
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'task:update',
      schema: taskUpdateSchema,
      handler: async (input, s) =>
        deps.updateTaskUseCase.execute({
          boardId: s.data.boardId!,
          actorId: s.data.user.id,
          taskId: input.taskId,
          title: input.title,
          description: input.description,
        }),
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'task:move',
      schema: taskMoveSchema,
      handler: async (input, s) =>
        deps.moveTaskUseCase.execute({
          boardId: s.data.boardId!,
          actorId: s.data.user.id,
          taskId: input.taskId,
          toSubcolumn: input.toSubcolumn,
          position: input.position,
        }),
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'task:delete',
      schema: taskDeleteSchema,
      handler: async (input, s) =>
        deps.deleteTaskUseCase.execute({
          boardId: s.data.boardId!,
          actorId: s.data.user.id,
          taskId: input.taskId,
        }),
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'note:create',
      schema: noteCreateSchema,
      handler: async (input, s) =>
        deps.createStickyNoteUseCase.execute({
          boardId: s.data.boardId!,
          actorId: s.data.user.id,
          content: input.content,
          color: input.color,
          posX: input.posX,
          posY: input.posY,
        }),
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'note:update',
      schema: noteUpdateSchema,
      handler: async (input, s) =>
        deps.updateStickyNoteUseCase.execute({
          boardId: s.data.boardId!,
          actorId: s.data.user.id,
          noteId: input.noteId,
          content: input.content,
          color: input.color,
          posX: input.posX,
          posY: input.posY,
        }),
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'note:delete',
      schema: noteDeleteSchema,
      handler: async (input, s) =>
        deps.deleteStickyNoteUseCase.execute({
          boardId: s.data.boardId!,
          actorId: s.data.user.id,
          noteId: input.noteId,
        }),
    });

    registerSocketHandler(socket, deps.rateLimiter, {
      event: 'activity:list',
      schema: activityListSchema,
      handler: async (input, s) => ({
        logs: await deps.listActivityLogsUseCase.execute({
          boardId: s.data.boardId!,
          userId: s.data.user.id,
          cursor: input.cursor,
          limit: input.limit,
          actorId: input.actorId,
          actionType: input.actionType,
        }),
      }),
    });

    socket.on('disconnect', () => {
      removeSocketFromBoard(socket);
    });
  });

  return io;
}
