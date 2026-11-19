export type ColumnType = 'BACKLOG' | 'SPECIFICATION' | 'IMPLEMENTATION' | 'CODE_REVIEW';

export type SubcolumnType =
  | 'BACKLOG'
  | 'IN_SPECIFICATION'
  | 'SPECIFIED'
  | 'IN_IMPLEMENTATION'
  | 'IMPLEMENTED'
  | 'IN_REVIEW'
  | 'REVIEWED';

export type StickyNoteColor = 'YELLOW' | 'BLUE' | 'PINK' | 'GREEN';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  inviteCode: string;
  createdById: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'OWNER' | 'MEMBER';
  joinedAt: string;
  userName?: string;
  userEmail?: string;
}

export interface TeamSummary {
  team: Team;
  role: 'OWNER' | 'MEMBER';
  projectId: string;
  projectName: string;
  boardId: string;
  memberCount: number;
  contextFileName: string;
  contextFileType: 'PDF' | 'MD' | 'TXT';
}

export interface BoardColumn {
  id: string;
  boardId: string;
  type: ColumnType;
  wipLimit: number | null;
  position: number;
}

export interface ColumnWipOccupancy {
  columnType: ColumnType;
  currentCount: number;
  wipLimit: number | null;
  isFull: boolean;
}

export interface UserStory {
  id: string;
  boardId: string;
  columnType: ColumnType;
  subcolumn: SubcolumnType;
  title: string;
  description: string;
  position: number;
  authorId: string;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriorityCriteria {
  businessAlignment: number;
  technicalDependency: number;
  userImpact: number;
  boardUrgency: number;
}

export interface Task {
  id: string;
  boardId: string;
  storyId: string;
  columnType: ColumnType;
  subcolumn: SubcolumnType;
  title: string;
  description: string;
  position: number;
  priorityScore: number;
  priorityConfidence: number;
  priorityCriteria: PriorityCriteria;
  classifiedByModel: string;
  authorId: string;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StickyNote {
  id: string;
  boardId: string;
  content: string;
  color: StickyNoteColor;
  posX: number;
  posY: number;
  authorId: string;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  boardId: string;
  actorId: string;
  actorName?: string;
  actionType: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface OnlineUser {
  id: string;
  email: string;
  name: string;
}

export interface BoardSnapshot {
  boardId: string;
  team: Team;
  members: TeamMember[];
  project: {
    id: string;
    name: string;
    contextFileName: string;
    contextFileType: 'PDF' | 'MD' | 'TXT';
    contextText: string;
  };
  columns: BoardColumn[];
  wipOccupancy: Record<ColumnType, ColumnWipOccupancy>;
  stories: UserStory[];
  tasks: Task[];
  notes: StickyNote[];
  activityLogs: ActivityLog[];
  onlineUsers?: OnlineUser[];
}

export type SocketAckResponse<T = unknown> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      message: string;
      fields?: Record<string, string[] | undefined>;
      retryAfterSeconds?: number;
    };

export const COLUMN_LABELS: Record<ColumnType, string> = {
  BACKLOG: 'Backlog',
  SPECIFICATION: 'Especificação',
  IMPLEMENTATION: 'Implementação',
  CODE_REVIEW: 'Revisão de Código',
};

export const SUBCOLUMN_LABELS: Record<SubcolumnType, string> = {
  BACKLOG: 'Backlog',
  IN_SPECIFICATION: 'Em especificação',
  SPECIFIED: 'Especificado',
  IN_IMPLEMENTATION: 'Em implementação',
  IMPLEMENTED: 'Implementado',
  IN_REVIEW: 'Em revisão',
  REVIEWED: 'Revisado',
};
