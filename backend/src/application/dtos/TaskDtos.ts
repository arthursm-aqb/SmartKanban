import { SubcolumnType } from '../../domain/value-objects/KanbanStage';

export interface DraftTaskInput {
  title: string;
  description?: string;
}

export interface GenerateTasksInput {
  storyId: string;
  tasks: DraftTaskInput[];
}

export interface GenerateTasksCommand extends GenerateTasksInput {
  boardId: string;
  actorId: string;
}

export interface UpdateTaskInput {
  taskId: string;
  title?: string;
  description?: string;
}

export interface UpdateTaskCommand extends UpdateTaskInput {
  boardId: string;
  actorId: string;
}

export type TaskMovableSubcolumn =
  | SubcolumnType.SPECIFIED
  | SubcolumnType.IN_IMPLEMENTATION
  | SubcolumnType.IMPLEMENTED
  | SubcolumnType.IN_REVIEW
  | SubcolumnType.REVIEWED;

export interface MoveTaskInput {
  taskId: string;
  toSubcolumn: TaskMovableSubcolumn;
  position: number;
}

export interface MoveTaskCommand extends MoveTaskInput {
  boardId: string;
  actorId: string;
}

export interface DeleteTaskInput {
  taskId: string;
}

export interface DeleteTaskCommand extends DeleteTaskInput {
  boardId: string;
  actorId: string;
}

export interface ReprioritizeStoryTasksInput {
  storyId: string;
}

export interface ReprioritizeStoryTasksCommand extends ReprioritizeStoryTasksInput {
  boardId: string;
  actorId: string;
}
