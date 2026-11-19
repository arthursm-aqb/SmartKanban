export enum ActivityActionType {
  TEAM_CREATED = 'TEAM_CREATED',
  MEMBER_JOINED = 'MEMBER_JOINED',
  WIP_UPDATED = 'WIP_UPDATED',
  STORY_CREATED = 'STORY_CREATED',
  STORY_UPDATED = 'STORY_UPDATED',
  STORY_MOVED = 'STORY_MOVED',
  STORY_DELETED = 'STORY_DELETED',
  TASKS_GENERATED = 'TASKS_GENERATED',
  TASKS_REPRIORITIZED = 'TASKS_REPRIORITIZED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_MOVED = 'TASK_MOVED',
  TASK_DELETED = 'TASK_DELETED',
  NOTE_CREATED = 'NOTE_CREATED',
  NOTE_UPDATED = 'NOTE_UPDATED',
  NOTE_DELETED = 'NOTE_DELETED',
}

export enum ActivityEntityType {
  TEAM = 'TEAM',
  BOARD_COLUMN = 'BOARD_COLUMN',
  STORY = 'STORY',
  TASK = 'TASK',
  STICKY_NOTE = 'STICKY_NOTE',
}

export interface ActivityLog {
  id: string;
  boardId: string;
  actorId: string;
  actorName?: string;
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}
