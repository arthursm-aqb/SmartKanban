import { UserStory } from '../../../domain/entities/UserStory';
import { ColumnType, SubcolumnType } from '../../../domain/value-objects/KanbanStage';

export interface CreateStoryRepoData {
  boardId: string;
  title: string;
  description: string;
  authorId: string;
  position: number;
}

export interface UpdateStoryRepoData {
  title?: string;
  description?: string;
}

export interface MoveStoryRepoData {
  columnType: ColumnType;
  subcolumn: SubcolumnType;
  position: number;
}

export interface IStoryRepository {
  findById(storyId: string): Promise<UserStory | null>;
  listByBoardId(boardId: string): Promise<UserStory[]>;
  create(data: CreateStoryRepoData): Promise<UserStory>;
  update(storyId: string, data: UpdateStoryRepoData): Promise<UserStory>;
  move(storyId: string, data: MoveStoryRepoData): Promise<UserStory>;
  delete(storyId: string): Promise<void>;
}
