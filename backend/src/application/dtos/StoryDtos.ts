import { SubcolumnType } from '../../domain/value-objects/KanbanStage';

export interface CreateStoryInput {
  title: string;
  description?: string;
}

export interface CreateStoryCommand extends CreateStoryInput {
  boardId: string;
  actorId: string;
}

export interface UpdateStoryInput {
  storyId: string;
  title?: string;
  description?: string;
}

export interface UpdateStoryCommand extends UpdateStoryInput {
  boardId: string;
  actorId: string;
}

export interface MoveStoryInput {
  storyId: string;
  toSubcolumn: SubcolumnType.BACKLOG | SubcolumnType.IN_SPECIFICATION;
  position: number;
}

export interface MoveStoryCommand extends MoveStoryInput {
  boardId: string;
  actorId: string;
}

export interface DeleteStoryInput {
  storyId: string;
}

export interface DeleteStoryCommand extends DeleteStoryInput {
  boardId: string;
  actorId: string;
}
