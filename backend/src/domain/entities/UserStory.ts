import { ColumnType, SubcolumnType } from '../value-objects/KanbanStage';

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
  createdAt: Date;
  updatedAt: Date;
}
