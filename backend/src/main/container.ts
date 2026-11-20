import { PrismaClient } from '@prisma/client';
import { IActivityLogRepository } from '../application/ports/repositories/IActivityLogRepository';
import { IBoardRepository } from '../application/ports/repositories/IBoardRepository';
import { IProjectRepository } from '../application/ports/repositories/IProjectRepository';
import { ISessionRepository } from '../application/ports/repositories/ISessionRepository';
import { IStickyNoteRepository } from '../application/ports/repositories/IStickyNoteRepository';
import { IStoryRepository } from '../application/ports/repositories/IStoryRepository';
import { ITaskRepository } from '../application/ports/repositories/ITaskRepository';
import { ITeamRepository } from '../application/ports/repositories/ITeamRepository';
import { IUserRepository } from '../application/ports/repositories/IUserRepository';
import { IDocumentParserRegistry } from '../application/ports/services/IDocumentParser';
import { IInviteCodeGenerator } from '../application/ports/services/IInviteCodeGenerator';
import { IPasswordHasher } from '../application/ports/services/IPasswordHasher';
import { IPriorityClassifier } from '../application/ports/services/IPriorityClassifier';
import { IRateLimiter } from '../application/ports/services/IRateLimiter';
import { ITokenService } from '../application/ports/services/ITokenService';
import { ListActivityLogsUseCase } from '../application/use-cases/activity/ListActivityLogsUseCase';
import { RecordActivityLogUseCase } from '../application/use-cases/activity/RecordActivityLogUseCase';
import { GetCurrentUserUseCase } from '../application/use-cases/auth/GetCurrentUserUseCase';
import { LoginUserUseCase } from '../application/use-cases/auth/LoginUserUseCase';
import { LogoutUseCase } from '../application/use-cases/auth/LogoutUseCase';
import { RefreshSessionUseCase } from '../application/use-cases/auth/RefreshSessionUseCase';
import { RegisterUserUseCase } from '../application/use-cases/auth/RegisterUserUseCase';
import { GetBoardSnapshotUseCase } from '../application/use-cases/board/GetBoardSnapshotUseCase';
import { UpdateColumnWipUseCase } from '../application/use-cases/board/UpdateColumnWipUseCase';
import { CreateStickyNoteUseCase } from '../application/use-cases/notes/CreateStickyNoteUseCase';
import { DeleteStickyNoteUseCase } from '../application/use-cases/notes/DeleteStickyNoteUseCase';
import { UpdateStickyNoteUseCase } from '../application/use-cases/notes/UpdateStickyNoteUseCase';
import { CreateStoryUseCase } from '../application/use-cases/stories/CreateStoryUseCase';
import { DeleteStoryUseCase } from '../application/use-cases/stories/DeleteStoryUseCase';
import { MoveStoryUseCase } from '../application/use-cases/stories/MoveStoryUseCase';
import { UpdateStoryUseCase } from '../application/use-cases/stories/UpdateStoryUseCase';
import { DeleteTaskUseCase } from '../application/use-cases/tasks/DeleteTaskUseCase';
import { GenerateAndPrioritizeTasksUseCase } from '../application/use-cases/tasks/GenerateAndPrioritizeTasksUseCase';
import { MoveTaskUseCase } from '../application/use-cases/tasks/MoveTaskUseCase';
import { ReprioritizeStoryTasksUseCase } from '../application/use-cases/tasks/ReprioritizeStoryTasksUseCase';
import { UpdateTaskUseCase } from '../application/use-cases/tasks/UpdateTaskUseCase';
import { CreateTeamWithProjectUseCase } from '../application/use-cases/teams/CreateTeamWithProjectUseCase';
import { JoinTeamByInviteUseCase } from '../application/use-cases/teams/JoinTeamByInviteUseCase';
import { ListUserTeamsUseCase } from '../application/use-cases/teams/ListUserTeamsUseCase';
import { WipPolicyService } from '../domain/services/WipPolicyService';
import { DeterministicFallbackClassifier } from '../infrastructure/ai/DeterministicFallbackClassifier';
import { GeminiDecisionsClassifier } from '../infrastructure/ai/GeminiDecisionsClassifier';
import { createPrismaClient } from '../infrastructure/database/prisma/prismaClient';
import { PrismaActivityLogRepository } from '../infrastructure/database/prisma/PrismaActivityLogRepository';
import { PrismaBoardRepository } from '../infrastructure/database/prisma/PrismaBoardRepository';
import { PrismaProjectRepository } from '../infrastructure/database/prisma/PrismaProjectRepository';
import { PrismaSessionRepository } from '../infrastructure/database/prisma/PrismaSessionRepository';
import { PrismaStickyNoteRepository } from '../infrastructure/database/prisma/PrismaStickyNoteRepository';
import { PrismaStoryRepository } from '../infrastructure/database/prisma/PrismaStoryRepository';
import { PrismaTaskRepository } from '../infrastructure/database/prisma/PrismaTaskRepository';
import { PrismaTeamRepository } from '../infrastructure/database/prisma/PrismaTeamRepository';
import { PrismaUserRepository } from '../infrastructure/database/prisma/PrismaUserRepository';
import { DocumentParserRegistry } from '../infrastructure/parsers/DocumentParserRegistry';
import { MarkdownDocumentParser } from '../infrastructure/parsers/MarkdownDocumentParser';
import { PdfDocumentParser } from '../infrastructure/parsers/PdfDocumentParser';
import { TxtDocumentParser } from '../infrastructure/parsers/TxtDocumentParser';
import { SocketIoRealtimePublisher } from '../infrastructure/realtime/SocketIoRealtimePublisher';
import { BcryptPasswordHasher } from '../infrastructure/security/BcryptPasswordHasher';
import { CryptoInviteCodeGenerator } from '../infrastructure/security/CryptoInviteCodeGenerator';
import { InMemoryRateLimiter } from '../infrastructure/security/InMemoryRateLimiter';
import { JwtTokenService } from '../infrastructure/security/JwtTokenService';
import { AuthController } from '../presentation/http/controllers/AuthController';
import { TeamController } from '../presentation/http/controllers/TeamController';
import { CookieConfig } from '../presentation/http/cookies';
import { AuthRateLimitOptions } from '../presentation/http/middlewares/rateLimitMiddleware';
import { AppEnv } from './env';

export interface ContainerDependencies {
  userRepository: IUserRepository;
  sessionRepository: ISessionRepository;
  teamRepository: ITeamRepository;
  projectRepository: IProjectRepository;
  boardRepository: IBoardRepository;
  storyRepository: IStoryRepository;
  taskRepository: ITaskRepository;
  stickyNoteRepository: IStickyNoteRepository;
  activityLogRepository: IActivityLogRepository;
  passwordHasher: IPasswordHasher;
  tokenService: ITokenService;
  documentParserRegistry: IDocumentParserRegistry;
  priorityClassifier: IPriorityClassifier;
  inviteCodeGenerator: IInviteCodeGenerator;
  rateLimiter: IRateLimiter;
  realtimePublisher: SocketIoRealtimePublisher;
  frontendOrigin: string;
  isProduction: boolean;
  cookieConfig?: CookieConfig;
  authRateLimitOptions?: AuthRateLimitOptions;
  prisma?: PrismaClient;
}

export interface AppContainer {
  frontendOrigin: string;
  isProduction: boolean;
  cookieConfig?: CookieConfig;
  authRateLimitOptions?: AuthRateLimitOptions;
  prisma?: PrismaClient;
  tokenService: ITokenService;
  rateLimiter: IRateLimiter;
  realtimePublisher: SocketIoRealtimePublisher;
  authController: AuthController;
  teamController: TeamController;
  useCases: {
    registerUser: RegisterUserUseCase;
    loginUser: LoginUserUseCase;
    refreshSession: RefreshSessionUseCase;
    logout: LogoutUseCase;
    getCurrentUser: GetCurrentUserUseCase;
    createTeamWithProject: CreateTeamWithProjectUseCase;
    joinTeamByInvite: JoinTeamByInviteUseCase;
    listUserTeams: ListUserTeamsUseCase;
    getBoardSnapshot: GetBoardSnapshotUseCase;
    updateColumnWip: UpdateColumnWipUseCase;
    createStory: CreateStoryUseCase;
    updateStory: UpdateStoryUseCase;
    moveStory: MoveStoryUseCase;
    deleteStory: DeleteStoryUseCase;
    generateAndPrioritizeTasks: GenerateAndPrioritizeTasksUseCase;
    reprioritizeStoryTasks: ReprioritizeStoryTasksUseCase;
    updateTask: UpdateTaskUseCase;
    moveTask: MoveTaskUseCase;
    deleteTask: DeleteTaskUseCase;
    createStickyNote: CreateStickyNoteUseCase;
    updateStickyNote: UpdateStickyNoteUseCase;
    deleteStickyNote: DeleteStickyNoteUseCase;
    listActivityLogs: ListActivityLogsUseCase;
  };
}

export function buildContainer(deps: ContainerDependencies): AppContainer {
  const wipPolicyService = new WipPolicyService();

  const recordActivityLog = new RecordActivityLogUseCase(
    deps.activityLogRepository,
    deps.realtimePublisher,
  );

  const registerUser = new RegisterUserUseCase(
    deps.userRepository,
    deps.sessionRepository,
    deps.passwordHasher,
    deps.tokenService,
  );
  const loginUser = new LoginUserUseCase(
    deps.userRepository,
    deps.sessionRepository,
    deps.passwordHasher,
    deps.tokenService,
  );
  const refreshSession = new RefreshSessionUseCase(
    deps.userRepository,
    deps.sessionRepository,
    deps.tokenService,
  );
  const logout = new LogoutUseCase(deps.sessionRepository, deps.tokenService);
  const getCurrentUser = new GetCurrentUserUseCase(deps.userRepository);

  const createTeamWithProject = new CreateTeamWithProjectUseCase(
    deps.teamRepository,
    deps.documentParserRegistry,
    deps.inviteCodeGenerator,
    recordActivityLog,
  );
  const joinTeamByInvite = new JoinTeamByInviteUseCase(
    deps.teamRepository,
    deps.boardRepository,
    deps.realtimePublisher,
    recordActivityLog,
  );
  const listUserTeams = new ListUserTeamsUseCase(deps.teamRepository);

  const getBoardSnapshot = new GetBoardSnapshotUseCase(
    deps.teamRepository,
    deps.projectRepository,
    deps.boardRepository,
    deps.storyRepository,
    deps.taskRepository,
    deps.stickyNoteRepository,
    deps.activityLogRepository,
    wipPolicyService,
  );
  const updateColumnWip = new UpdateColumnWipUseCase(
    deps.teamRepository,
    deps.boardRepository,
    deps.storyRepository,
    deps.taskRepository,
    wipPolicyService,
    deps.realtimePublisher,
    recordActivityLog,
  );

  const createStory = new CreateStoryUseCase(
    deps.teamRepository,
    deps.boardRepository,
    deps.storyRepository,
    deps.taskRepository,
    wipPolicyService,
    deps.realtimePublisher,
    recordActivityLog,
  );
  const updateStory = new UpdateStoryUseCase(
    deps.teamRepository,
    deps.storyRepository,
    deps.realtimePublisher,
    recordActivityLog,
  );
  const moveStory = new MoveStoryUseCase(
    deps.teamRepository,
    deps.boardRepository,
    deps.storyRepository,
    deps.taskRepository,
    wipPolicyService,
    deps.realtimePublisher,
    recordActivityLog,
  );
  const deleteStory = new DeleteStoryUseCase(
    deps.teamRepository,
    deps.boardRepository,
    deps.storyRepository,
    deps.taskRepository,
    wipPolicyService,
    deps.realtimePublisher,
    recordActivityLog,
  );

  const generateAndPrioritizeTasks = new GenerateAndPrioritizeTasksUseCase(
    deps.teamRepository,
    deps.projectRepository,
    deps.boardRepository,
    deps.storyRepository,
    deps.taskRepository,
    deps.priorityClassifier,
    wipPolicyService,
    deps.rateLimiter,
    deps.realtimePublisher,
    recordActivityLog,
  );
  const reprioritizeStoryTasks = new ReprioritizeStoryTasksUseCase(
    deps.teamRepository,
    deps.projectRepository,
    deps.storyRepository,
    deps.taskRepository,
    deps.priorityClassifier,
    deps.rateLimiter,
    deps.realtimePublisher,
    recordActivityLog,
  );
  const updateTask = new UpdateTaskUseCase(
    deps.teamRepository,
    deps.taskRepository,
    deps.realtimePublisher,
    recordActivityLog,
  );
  const moveTask = new MoveTaskUseCase(
    deps.teamRepository,
    deps.boardRepository,
    deps.storyRepository,
    deps.taskRepository,
    wipPolicyService,
    deps.realtimePublisher,
    recordActivityLog,
  );
  const deleteTask = new DeleteTaskUseCase(
    deps.teamRepository,
    deps.boardRepository,
    deps.storyRepository,
    deps.taskRepository,
    wipPolicyService,
    deps.realtimePublisher,
    recordActivityLog,
  );

  const createStickyNote = new CreateStickyNoteUseCase(
    deps.teamRepository,
    deps.stickyNoteRepository,
    deps.realtimePublisher,
    recordActivityLog,
  );
  const updateStickyNote = new UpdateStickyNoteUseCase(
    deps.teamRepository,
    deps.stickyNoteRepository,
    deps.realtimePublisher,
    recordActivityLog,
  );
  const deleteStickyNote = new DeleteStickyNoteUseCase(
    deps.teamRepository,
    deps.stickyNoteRepository,
    deps.realtimePublisher,
    recordActivityLog,
  );

  const listActivityLogs = new ListActivityLogsUseCase(
    deps.teamRepository,
    deps.activityLogRepository,
  );

  const cookieConfig: CookieConfig = deps.cookieConfig ?? {
    secure: deps.isProduction,
    sameSite: deps.isProduction ? 'none' : 'lax',
  };

  const authController = new AuthController(
    registerUser,
    loginUser,
    refreshSession,
    logout,
    getCurrentUser,
    cookieConfig,
  );

  const teamController = new TeamController(
    createTeamWithProject,
    joinTeamByInvite,
    listUserTeams,
  );

  return {
    frontendOrigin: deps.frontendOrigin,
    isProduction: deps.isProduction,
    authRateLimitOptions: deps.authRateLimitOptions,
    prisma: deps.prisma,
    tokenService: deps.tokenService,
    rateLimiter: deps.rateLimiter,
    realtimePublisher: deps.realtimePublisher,
    authController,
    teamController,
    useCases: {
      registerUser,
      loginUser,
      refreshSession,
      logout,
      getCurrentUser,
      createTeamWithProject,
      joinTeamByInvite,
      listUserTeams,
      getBoardSnapshot,
      updateColumnWip,
      createStory,
      updateStory,
      moveStory,
      deleteStory,
      generateAndPrioritizeTasks,
      reprioritizeStoryTasks,
      updateTask,
      moveTask,
      deleteTask,
      createStickyNote,
      updateStickyNote,
      deleteStickyNote,
      listActivityLogs,
    },
  };
}

export function createProductionContainer(env: AppEnv): AppContainer {
  const prisma = createPrismaClient();
  const fallbackClassifier = new DeterministicFallbackClassifier();
  const priorityClassifier = new GeminiDecisionsClassifier(fallbackClassifier, {
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
  });

  const documentParserRegistry = new DocumentParserRegistry([
    new PdfDocumentParser(),
    new MarkdownDocumentParser(),
    new TxtDocumentParser(),
  ]);

  return buildContainer({
    prisma,
    userRepository: new PrismaUserRepository(prisma),
    sessionRepository: new PrismaSessionRepository(prisma),
    teamRepository: new PrismaTeamRepository(prisma),
    projectRepository: new PrismaProjectRepository(prisma),
    boardRepository: new PrismaBoardRepository(prisma),
    storyRepository: new PrismaStoryRepository(prisma),
    taskRepository: new PrismaTaskRepository(prisma),
    stickyNoteRepository: new PrismaStickyNoteRepository(prisma),
    activityLogRepository: new PrismaActivityLogRepository(prisma),
    passwordHasher: new BcryptPasswordHasher(12),
    tokenService: new JwtTokenService({
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
    }),
    documentParserRegistry,
    priorityClassifier,
    inviteCodeGenerator: new CryptoInviteCodeGenerator(),
    rateLimiter: new InMemoryRateLimiter(),
    realtimePublisher: new SocketIoRealtimePublisher(),
    frontendOrigin: env.FRONTEND_ORIGIN,
    isProduction: env.NODE_ENV === 'production',
    cookieConfig: {
      secure: env.NODE_ENV === 'production',
      sameSite: env.COOKIE_SAME_SITE ?? (env.NODE_ENV === 'production' ? 'none' : 'lax'),
      domain: env.COOKIE_DOMAIN,
    },
  });
}
