import { PrismaClient } from '@prisma/client';
import { IBoardRepository } from '../../../application/ports/repositories/IBoardRepository';
import { BoardColumn } from '../../../domain/entities/BoardColumn';
import { Board } from '../../../domain/entities/Project';
import { ColumnType } from '../../../domain/value-objects/KanbanStage';

export class PrismaBoardRepository implements IBoardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findById(boardId: string): Promise<Board | null> {
    return this.prisma.board.findUnique({ where: { id: boardId } });
  }

  public async findByTeamId(teamId: string): Promise<Board | null> {
    const project = await this.prisma.project.findUnique({
      where: { teamId },
      include: { board: true },
    });
    return project?.board ?? null;
  }

  public async listColumns(boardId: string): Promise<BoardColumn[]> {
    const columns = await this.prisma.boardColumn.findMany({
      where: { boardId },
      orderBy: { position: 'asc' },
    });
    return columns.map((col) => ({
      id: col.id,
      boardId: col.boardId,
      type: col.type as ColumnType,
      wipLimit: col.wipLimit,
      position: col.position,
    }));
  }

  public async updateColumnWipLimit(
    boardId: string,
    columnType: ColumnType,
    wipLimit: number | null,
  ): Promise<BoardColumn> {
    const updated = await this.prisma.boardColumn.update({
      where: { boardId_type: { boardId, type: columnType } },
      data: { wipLimit },
    });
    return {
      id: updated.id,
      boardId: updated.boardId,
      type: updated.type as ColumnType,
      wipLimit: updated.wipLimit,
      position: updated.position,
    };
  }
}
