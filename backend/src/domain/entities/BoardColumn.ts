import { ColumnType } from '../value-objects/KanbanStage';

export interface BoardColumn {
  id: string;
  boardId: string;
  type: ColumnType;
  wipLimit: number | null;
  position: number;
}
