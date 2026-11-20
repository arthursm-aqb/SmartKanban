import crypto from 'crypto';
import {
  CreateActivityLogRepoData,
  IActivityLogRepository,
  ListActivityLogsFilter,
} from '../../src/application/ports/repositories/IActivityLogRepository';
import { IBoardRepository } from '../../src/application/ports/repositories/IBoardRepository';
import { IProjectRepository } from '../../src/application/ports/repositories/IProjectRepository';
import {
  CreateRefreshSessionData,
  ISessionRepository,
} from '../../src/application/ports/repositories/ISessionRepository';
import {
  CreateStickyNoteRepoData,
  IStickyNoteRepository,
  UpdateStickyNoteRepoData,
} from '../../src/application/ports/repositories/IStickyNoteRepository';
import {
  CreateStoryRepoData,
  IStoryRepository,
  MoveStoryRepoData,
  UpdateStoryRepoData,
} from '../../src/application/ports/repositories/IStoryRepository';
import {
  CreateTaskRepoData,
  ITaskRepository,
  MoveTaskRepoData,
  UpdateTaskPriorityRepoData,
  UpdateTaskRepoData,
} from '../../src/application/ports/repositories/ITaskRepository';
import {
  CreatedTeamBundle,
  CreateTeamWithProjectRepoData,
  ITeamRepository,
} from '../../src/application/ports/repositories/ITeamRepository';
import { CreateUserData, IUserRepository } from '../../src/application/ports/repositories/IUserRepository';
import { IPriorityClassifier } from '../../src/application/ports/services/IPriorityClassifier';
import { ActivityLog } from '../../src/domain/entities/ActivityLog';
import { BoardColumn } from '../../src/domain/entities/BoardColumn';
import { Board, Project } from '../../src/domain/entities/Project';
import { RefreshSession } from '../../src/domain/entities/RefreshSession';
import { StickyNote } from '../../src/domain/entities/StickyNote';
import { Task } from '../../src/domain/entities/Task';
import { Team, TeamMember, TeamRole, TeamSummary } from '../../src/domain/entities/Team';
import { User } from '../../src/domain/entities/User';
import { UserStory } from '../../src/domain/entities/UserStory';
import {
  ColumnType,
  INITIAL_COLUMN_ORDER,
  SubcolumnType,
} from '../../src/domain/value-objects/KanbanStage';
import { DeterministicFallbackClassifier } from '../../src/infrastructure/ai/DeterministicFallbackClassifier';
import { DocumentParserRegistry } from '../../src/infrastructure/parsers/DocumentParserRegistry';
import { MarkdownDocumentParser } from '../../src/infrastructure/parsers/MarkdownDocumentParser';
import { PdfDocumentParser } from '../../src/infrastructure/parsers/PdfDocumentParser';
import { TxtDocumentParser } from '../../src/infrastructure/parsers/TxtDocumentParser';
import { SocketIoRealtimePublisher } from '../../src/infrastructure/realtime/SocketIoRealtimePublisher';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/BcryptPasswordHasher';
import { CryptoInviteCodeGenerator } from '../../src/infrastructure/security/CryptoInviteCodeGenerator';
import { InMemoryRateLimiter } from '../../src/infrastructure/security/InMemoryRateLimiter';
import { JwtTokenService } from '../../src/infrastructure/security/JwtTokenService';
import { AppContainer, buildContainer } from '../../src/main/container';
import { CookieConfig } from '../../src/presentation/http/cookies';
import { AuthRateLimitOptions } from '../../src/presentation/http/middlewares/rateLimitMiddleware';

export class InMemoryStore {
  public users = new Map<string, User>();
  public sessions = new Map<string, RefreshSession>();
  public teams = new Map<string, Team>();
  public members = new Map<string, TeamMember>();
  public projects = new Map<string, Project>();
  public boards = new Map<string, Board>();
  public columns = new Map<string, BoardColumn>();
  public stories = new Map<string, UserStory>();
  public tasks = new Map<string, Task>();
  public notes = new Map<string, StickyNote>();
  public activityLogs: ActivityLog[] = [];
}

class InMemoryUserRepository implements IUserRepository {
  constructor(private readonly store: InMemoryStore) {}
  async findById(id: string): Promise<User | null> {
    return this.store.users.get(id) ?? null;
  }
  async findByEmail(email: string): Promise<User | null> {
    for (const u of this.store.users.values()) {
      if (u.email === email) return u;
    }
    return null;
  }
  async create(data: CreateUserData): Promise<User> {
    const now = new Date();
    const user: User = { id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now };
    this.store.users.set(user.id, user);
    return user;
  }
}

class InMemorySessionRepository implements ISessionRepository {
  constructor(private readonly store: InMemoryStore) {}
  async create(data: CreateRefreshSessionData): Promise<RefreshSession> {
    const session: RefreshSession = {
      id: crypto.randomUUID(),
      userId: data.userId,
      familyId: data.familyId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
      replacedBySessionId: null,
      createdAt: new Date(),
    };
    this.store.sessions.set(session.id, session);
    return session;
  }
  async findByTokenHash(tokenHash: string): Promise<RefreshSession | null> {
    for (const s of this.store.sessions.values()) {
      if (s.tokenHash === tokenHash) return s;
    }
    return null;
  }
  async revokeSession(sessionId: string, replacedBySessionId?: string | null): Promise<void> {
    const s = this.store.sessions.get(sessionId);
    if (s) {
      s.revokedAt = new Date();
      s.replacedBySessionId = replacedBySessionId ?? null;
    }
  }
  async revokeFamily(familyId: string): Promise<void> {
    const now = new Date();
    for (const s of this.store.sessions.values()) {
      if (s.familyId === familyId && !s.revokedAt) s.revokedAt = now;
    }
  }
  async revokeAllForUser(userId: string): Promise<void> {
    const now = new Date();
    for (const s of this.store.sessions.values()) {
      if (s.userId === userId && !s.revokedAt) s.revokedAt = now;
    }
  }
}

class InMemoryTeamRepository implements ITeamRepository {
  constructor(private readonly store: InMemoryStore) {}

  async createTeamWithProjectAndBoard(data: CreateTeamWithProjectRepoData): Promise<CreatedTeamBundle> {
    const now = new Date();
    const team: Team = {
      id: crypto.randomUUID(),
      name: data.teamName,
      inviteCode: data.inviteCode,
      createdById: data.createdById,
      createdAt: now,
      updatedAt: now,
    };
    this.store.teams.set(team.id, team);

    const creator = this.store.users.get(data.createdById);
    const member: TeamMember = {
      id: crypto.randomUUID(),
      teamId: team.id,
      userId: data.createdById,
      role: TeamRole.OWNER,
      joinedAt: now,
      userName: creator?.name,
      userEmail: creator?.email,
    };
    this.store.members.set(member.id, member);

    const project: Project = {
      id: crypto.randomUUID(),
      teamId: team.id,
      name: data.projectName,
      contextFileName: data.contextFileName,
      contextFileType: data.contextFileType,
      contextText: data.contextText,
      createdAt: now,
      updatedAt: now,
    };
    this.store.projects.set(project.id, project);

    const board: Board = {
      id: crypto.randomUUID(),
      projectId: project.id,
      createdAt: now,
      updatedAt: now,
    };
    this.store.boards.set(board.id, board);

    for (const colDef of INITIAL_COLUMN_ORDER) {
      const col: BoardColumn = {
        id: crypto.randomUUID(),
        boardId: board.id,
        type: colDef.type,
        wipLimit: null,
        position: colDef.position,
      };
      this.store.columns.set(col.id, col);
    }

    return { team, projectId: project.id, boardId: board.id };
  }

  async findById(teamId: string): Promise<Team | null> {
    return this.store.teams.get(teamId) ?? null;
  }

  async findByInviteCode(inviteCode: string): Promise<Team | null> {
    for (const t of this.store.teams.values()) {
      if (t.inviteCode === inviteCode) return t;
    }
    return null;
  }

  async findMember(teamId: string, userId: string): Promise<TeamMember | null> {
    for (const m of this.store.members.values()) {
      if (m.teamId === teamId && m.userId === userId) return m;
    }
    return null;
  }

  async addMember(teamId: string, userId: string, role: TeamRole): Promise<TeamMember> {
    const user = this.store.users.get(userId);
    const member: TeamMember = {
      id: crypto.randomUUID(),
      teamId,
      userId,
      role,
      joinedAt: new Date(),
      userName: user?.name,
      userEmail: user?.email,
    };
    this.store.members.set(member.id, member);
    return member;
  }

  async listMembers(teamId: string): Promise<TeamMember[]> {
    return Array.from(this.store.members.values()).filter((m) => m.teamId === teamId);
  }

  async listUserTeams(userId: string): Promise<TeamSummary[]> {
    const userMemberships = Array.from(this.store.members.values()).filter((m) => m.userId === userId);
    const summaries: TeamSummary[] = [];
    for (const membership of userMemberships) {
      const team = this.store.teams.get(membership.teamId);
      if (!team) continue;
      const project = Array.from(this.store.projects.values()).find((p) => p.teamId === team.id);
      if (!project) continue;
      const board = Array.from(this.store.boards.values()).find((b) => b.projectId === project.id);
      if (!board) continue;
      const memberCount = Array.from(this.store.members.values()).filter((m) => m.teamId === team.id).length;
      summaries.push({
        team,
        role: membership.role,
        projectId: project.id,
        projectName: project.name,
        boardId: board.id,
        memberCount,
        contextFileName: project.contextFileName,
        contextFileType: project.contextFileType,
      });
    }
    return summaries;
  }

  async isMemberOfBoard(boardId: string, userId: string): Promise<boolean> {
    const board = this.store.boards.get(boardId);
    if (!board) return false;
    const project = this.store.projects.get(board.projectId);
    if (!project) return false;
    const member = await this.findMember(project.teamId, userId);
    return member !== null;
  }
}

class InMemoryProjectRepository implements IProjectRepository {
  constructor(private readonly store: InMemoryStore) {}
  async findByTeamId(teamId: string): Promise<Project | null> {
    return Array.from(this.store.projects.values()).find((p) => p.teamId === teamId) ?? null;
  }
  async findByBoardId(boardId: string): Promise<Project | null> {
    const board = this.store.boards.get(boardId);
    if (!board) return null;
    return this.store.projects.get(board.projectId) ?? null;
  }
}

class InMemoryBoardRepository implements IBoardRepository {
  constructor(private readonly store: InMemoryStore) {}
  async findById(boardId: string): Promise<Board | null> {
    return this.store.boards.get(boardId) ?? null;
  }
  async findByTeamId(teamId: string): Promise<Board | null> {
    const project = Array.from(this.store.projects.values()).find((p) => p.teamId === teamId);
    if (!project) return null;
    return Array.from(this.store.boards.values()).find((b) => b.projectId === project.id) ?? null;
  }
  async listColumns(boardId: string): Promise<BoardColumn[]> {
    return Array.from(this.store.columns.values())
      .filter((c) => c.boardId === boardId)
      .sort((a, b) => a.position - b.position);
  }
  async updateColumnWipLimit(
    boardId: string,
    columnType: ColumnType,
    wipLimit: number | null,
  ): Promise<BoardColumn> {
    const col = Array.from(this.store.columns.values()).find(
      (c) => c.boardId === boardId && c.type === columnType,
    );
    if (!col) throw new Error(`Column ${columnType} not found`);
    col.wipLimit = wipLimit;
    return { ...col };
  }
}

class InMemoryStoryRepository implements IStoryRepository {
  constructor(private readonly store: InMemoryStore) {}
  async findById(storyId: string): Promise<UserStory | null> {
    const s = this.store.stories.get(storyId);
    return s ? { ...s } : null;
  }
  async listByBoardId(boardId: string): Promise<UserStory[]> {
    return Array.from(this.store.stories.values())
      .filter((s) => s.boardId === boardId)
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ ...s }));
  }
  async create(data: CreateStoryRepoData): Promise<UserStory> {
    const now = new Date();
    const author = this.store.users.get(data.authorId);
    const story: UserStory = {
      id: crypto.randomUUID(),
      boardId: data.boardId,
      columnType: ColumnType.BACKLOG,
      subcolumn: SubcolumnType.BACKLOG,
      title: data.title,
      description: data.description,
      position: data.position,
      authorId: data.authorId,
      authorName: author?.name,
      createdAt: now,
      updatedAt: now,
    };
    this.store.stories.set(story.id, story);
    return { ...story };
  }
  async update(storyId: string, data: UpdateStoryRepoData): Promise<UserStory> {
    const s = this.store.stories.get(storyId)!;
    if (data.title !== undefined) s.title = data.title;
    if (data.description !== undefined) s.description = data.description;
    s.updatedAt = new Date();
    return { ...s };
  }
  async move(storyId: string, data: MoveStoryRepoData): Promise<UserStory> {
    const s = this.store.stories.get(storyId)!;
    s.columnType = data.columnType;
    s.subcolumn = data.subcolumn;
    s.position = data.position;
    s.updatedAt = new Date();
    return { ...s };
  }
  async delete(storyId: string): Promise<void> {
    this.store.stories.delete(storyId);
    for (const [taskId, t] of this.store.tasks.entries()) {
      if (t.storyId === storyId) this.store.tasks.delete(taskId);
    }
  }
}

class InMemoryTaskRepository implements ITaskRepository {
  constructor(private readonly store: InMemoryStore) {}
  async findById(taskId: string): Promise<Task | null> {
    const t = this.store.tasks.get(taskId);
    return t ? { ...t } : null;
  }
  async listByBoardId(boardId: string): Promise<Task[]> {
    return Array.from(this.store.tasks.values())
      .filter((t) => t.boardId === boardId)
      .sort((a, b) => b.priorityScore - a.priorityScore || a.position - b.position)
      .map((t) => ({ ...t }));
  }
  async listByStoryId(storyId: string): Promise<Task[]> {
    return Array.from(this.store.tasks.values())
      .filter((t) => t.storyId === storyId)
      .sort((a, b) => a.position - b.position)
      .map((t) => ({ ...t }));
  }
  async createManyAndMarkStorySpecified(storyId: string, tasks: CreateTaskRepoData[]): Promise<Task[]> {
    const story = this.store.stories.get(storyId)!;
    story.columnType = ColumnType.SPECIFICATION;
    story.subcolumn = SubcolumnType.SPECIFIED;
    story.updatedAt = new Date();

    const now = new Date();
    const created: Task[] = [];
    for (const data of tasks) {
      const author = this.store.users.get(data.authorId);
      const task: Task = {
        id: crypto.randomUUID(),
        boardId: data.boardId,
        storyId: data.storyId,
        columnType: ColumnType.SPECIFICATION,
        subcolumn: SubcolumnType.SPECIFIED,
        title: data.title,
        description: data.description,
        position: data.position,
        priorityScore: data.priorityScore,
        priorityConfidence: data.priorityConfidence,
        priorityCriteria: data.priorityCriteria,
        classifiedByModel: data.classifiedByModel,
        authorId: data.authorId,
        authorName: author?.name,
        createdAt: now,
        updatedAt: now,
      };
      this.store.tasks.set(task.id, task);
      created.push({ ...task });
    }
    return created;
  }
  async update(taskId: string, data: UpdateTaskRepoData): Promise<Task> {
    const t = this.store.tasks.get(taskId)!;
    if (data.title !== undefined) t.title = data.title;
    if (data.description !== undefined) t.description = data.description;
    t.updatedAt = new Date();
    return { ...t };
  }
  async updatePriority(taskId: string, data: UpdateTaskPriorityRepoData): Promise<Task> {
    const t = this.store.tasks.get(taskId)!;
    t.priorityScore = data.priorityScore;
    t.priorityConfidence = data.priorityConfidence;
    t.priorityCriteria = data.priorityCriteria;
    t.classifiedByModel = data.classifiedByModel;
    t.updatedAt = new Date();
    return { ...t };
  }
  async move(taskId: string, data: MoveTaskRepoData): Promise<Task> {
    const t = this.store.tasks.get(taskId)!;
    t.columnType = data.columnType;
    t.subcolumn = data.subcolumn;
    t.position = data.position;
    t.updatedAt = new Date();
    return { ...t };
  }
  async delete(taskId: string): Promise<void> {
    this.store.tasks.delete(taskId);
  }
}

class InMemoryStickyNoteRepository implements IStickyNoteRepository {
  constructor(private readonly store: InMemoryStore) {}
  async findById(noteId: string): Promise<StickyNote | null> {
    const n = this.store.notes.get(noteId);
    return n ? { ...n } : null;
  }
  async listByBoardId(boardId: string): Promise<StickyNote[]> {
    return Array.from(this.store.notes.values())
      .filter((n) => n.boardId === boardId)
      .map((n) => ({ ...n }));
  }
  async create(data: CreateStickyNoteRepoData): Promise<StickyNote> {
    const now = new Date();
    const author = this.store.users.get(data.authorId);
    const note: StickyNote = {
      id: crypto.randomUUID(),
      boardId: data.boardId,
      content: data.content,
      color: data.color,
      posX: data.posX,
      posY: data.posY,
      authorId: data.authorId,
      authorName: author?.name,
      createdAt: now,
      updatedAt: now,
    };
    this.store.notes.set(note.id, note);
    return { ...note };
  }
  async update(noteId: string, data: UpdateStickyNoteRepoData): Promise<StickyNote> {
    const n = this.store.notes.get(noteId)!;
    if (data.content !== undefined) n.content = data.content;
    if (data.color !== undefined) n.color = data.color;
    if (data.posX !== undefined) n.posX = data.posX;
    if (data.posY !== undefined) n.posY = data.posY;
    n.updatedAt = new Date();
    return { ...n };
  }
  async delete(noteId: string): Promise<void> {
    this.store.notes.delete(noteId);
  }
}

class InMemoryActivityLogRepository implements IActivityLogRepository {
  constructor(private readonly store: InMemoryStore) {}
  async create(data: CreateActivityLogRepoData): Promise<ActivityLog> {
    const actor = this.store.users.get(data.actorId);
    const log: ActivityLog = {
      id: crypto.randomUUID(),
      boardId: data.boardId,
      actorId: data.actorId,
      actorName: actor?.name,
      actionType: data.actionType,
      entityType: data.entityType,
      entityId: data.entityId,
      summary: data.summary,
      metadata: data.metadata ?? null,
      createdAt: new Date(),
    };
    this.store.activityLogs.unshift(log);
    return log;
  }
  async listByBoard(filter: ListActivityLogsFilter): Promise<ActivityLog[]> {
    let logs = this.store.activityLogs.filter((l) => l.boardId === filter.boardId);
    if (filter.actorId) logs = logs.filter((l) => l.actorId === filter.actorId);
    if (filter.actionType) logs = logs.filter((l) => l.actionType === filter.actionType);
    if (filter.cursor) {
      const idx = logs.findIndex((l) => l.id === filter.cursor);
      if (idx !== -1) logs = logs.slice(idx + 1);
    }
    return logs.slice(0, filter.limit);
  }
}

export function createTestContainer(options?: {
  priorityClassifier?: IPriorityClassifier;
  frontendOrigin?: string;
  isProduction?: boolean;
  cookieConfig?: CookieConfig;
  authRateLimitOptions?: AuthRateLimitOptions;
}): { container: AppContainer; store: InMemoryStore } {
  const store = new InMemoryStore();
  const container = buildContainer({
    userRepository: new InMemoryUserRepository(store),
    sessionRepository: new InMemorySessionRepository(store),
    teamRepository: new InMemoryTeamRepository(store),
    projectRepository: new InMemoryProjectRepository(store),
    boardRepository: new InMemoryBoardRepository(store),
    storyRepository: new InMemoryStoryRepository(store),
    taskRepository: new InMemoryTaskRepository(store),
    stickyNoteRepository: new InMemoryStickyNoteRepository(store),
    activityLogRepository: new InMemoryActivityLogRepository(store),
    passwordHasher: new BcryptPasswordHasher(4),
    tokenService: new JwtTokenService({
      accessSecret: 'test_access_secret_key_with_more_than_32_characters_01',
      refreshSecret: 'test_refresh_secret_key_with_more_than_32_characters_02',
    }),
    documentParserRegistry: new DocumentParserRegistry([
      new PdfDocumentParser(),
      new MarkdownDocumentParser(),
      new TxtDocumentParser(),
    ]),
    priorityClassifier: options?.priorityClassifier ?? new DeterministicFallbackClassifier(),
    inviteCodeGenerator: new CryptoInviteCodeGenerator(),
    rateLimiter: new InMemoryRateLimiter(),
    realtimePublisher: new SocketIoRealtimePublisher(),
    frontendOrigin: options?.frontendOrigin ?? 'http://localhost:5173',
    isProduction: options?.isProduction ?? false,
    cookieConfig: options?.cookieConfig,
    authRateLimitOptions: options?.authRateLimitOptions,
  });

  return { container, store };
}
