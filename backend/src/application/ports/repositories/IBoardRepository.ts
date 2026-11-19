import { Board } from '../../../domain/entities/Project';
import { BoardColumn } from '../../../domain/entities/BoardColumn';
import { ColumnType } from '../../../domain/value-objects/KanbanStage';

export interface IBoardRepository {
  findById(boardId: string): Promise<Board | null>;
  findByTeamId(teamId: string): Promise<Board | null>;
  listColumns(boardId: string): Promise<BoardColumn[]>;
  updateColumnWipLimit(boardId: string, columnType: ColumnType, wipLimit: number | null): Promise<BoardColumn>;
}
