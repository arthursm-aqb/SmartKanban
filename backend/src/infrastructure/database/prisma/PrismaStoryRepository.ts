import { PrismaClient } from '@prisma/client';
import {
  CreateStoryRepoData,
  IStoryRepository,
  MoveStoryRepoData,
  UpdateStoryRepoData,
} from '../../../application/ports/repositories/IStoryRepository';
import { UserStory } from '../../../domain/entities/UserStory';
import { ColumnType, SubcolumnType } from '../../../domain/value-objects/KanbanStage';

function mapStory(row: {
  id: string;
  boardId: string;
  columnType: string;
  subcolumn: string;
  title: string;
  description: string;
  position: number;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  author?: { name: string };
}): UserStory {
  return {
    id: row.id,
    boardId: row.boardId,
    columnType: row.columnType as ColumnType,
    subcolumn: row.subcolumn as SubcolumnType,
    title: row.title,
    description: row.description,
    position: row.position,
    authorId: row.authorId,
    authorName: row.author?.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaStoryRepository implements IStoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findById(storyId: string): Promise<UserStory | null> {
    const row = await this.prisma.userStory.findUnique({
      where: { id: storyId },
      include: { author: { select: { name: true } } },
    });
    return row ? mapStory(row) : null;
  }

  public async listByBoardId(boardId: string): Promise<UserStory[]> {
    const rows = await this.prisma.userStory.findMany({
      where: { boardId },
      include: { author: { select: { name: true } } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(mapStory);
  }

  public async create(data: CreateStoryRepoData): Promise<UserStory> {
    const row = await this.prisma.userStory.create({
      data: {
        boardId: data.boardId,
        columnType: ColumnType.BACKLOG,
        subcolumn: SubcolumnType.BACKLOG,
        title: data.title,
        description: data.description,
        position: data.position,
        authorId: data.authorId,
      },
      include: { author: { select: { name: true } } },
    });
    return mapStory(row);
  }

  public async update(storyId: string, data: UpdateStoryRepoData): Promise<UserStory> {
    const row = await this.prisma.userStory.update({
      where: { id: storyId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
      include: { author: { select: { name: true } } },
    });
    return mapStory(row);
  }

  public async move(storyId: string, data: MoveStoryRepoData): Promise<UserStory> {
    const row = await this.prisma.userStory.update({
      where: { id: storyId },
      data: {
        columnType: data.columnType,
        subcolumn: data.subcolumn,
        position: data.position,
      },
      include: { author: { select: { name: true } } },
    });
    return mapStory(row);
  }

  public async delete(storyId: string): Promise<void> {
    await this.prisma.userStory.delete({ where: { id: storyId } });
  }
}
