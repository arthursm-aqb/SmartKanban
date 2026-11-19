import { Prisma, PrismaClient } from '@prisma/client';
import {
  CreateTaskRepoData,
  ITaskRepository,
  MoveTaskRepoData,
  UpdateTaskPriorityRepoData,
  UpdateTaskRepoData,
} from '../../../application/ports/repositories/ITaskRepository';
import { Task } from '../../../domain/entities/Task';
import { ColumnType, SubcolumnType } from '../../../domain/value-objects/KanbanStage';
import { PriorityCriteria } from '../../../domain/value-objects/PriorityScore';

function mapTask(row: {
  id: string;
  boardId: string;
  storyId: string;
  columnType: string;
  subcolumn: string;
  title: string;
  description: string;
  position: number;
  priorityScore: number;
  priorityConfidence: number;
  priorityCriteriaJson: Prisma.JsonValue;
  classifiedByModel: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  author?: { name: string };
}): Task {
  return {
    id: row.id,
    boardId: row.boardId,
    storyId: row.storyId,
    columnType: row.columnType as ColumnType,
    subcolumn: row.subcolumn as SubcolumnType,
    title: row.title,
    description: row.description,
    position: row.position,
    priorityScore: row.priorityScore,
    priorityConfidence: row.priorityConfidence,
    priorityCriteria: row.priorityCriteriaJson as unknown as PriorityCriteria,
    classifiedByModel: row.classifiedByModel,
    authorId: row.authorId,
    authorName: row.author?.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaTaskRepository implements ITaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findById(taskId: string): Promise<Task | null> {
    const row = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { author: { select: { name: true } } },
    });
    return row ? mapTask(row) : null;
  }

  public async listByBoardId(boardId: string): Promise<Task[]> {
    const rows = await this.prisma.task.findMany({
      where: { boardId },
      include: { author: { select: { name: true } } },
      orderBy: [{ priorityScore: 'desc' }, { position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(mapTask);
  }

  public async listByStoryId(storyId: string): Promise<Task[]> {
    const rows = await this.prisma.task.findMany({
      where: { storyId },
      include: { author: { select: { name: true } } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(mapTask);
  }

  public async createManyAndMarkStorySpecified(
    storyId: string,
    tasks: CreateTaskRepoData[],
  ): Promise<Task[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.userStory.update({
        where: { id: storyId },
        data: {
          columnType: ColumnType.SPECIFICATION,
          subcolumn: SubcolumnType.SPECIFIED,
        },
      });

      const created: Task[] = [];
      for (const taskData of tasks) {
        const row = await tx.task.create({
          data: {
            boardId: taskData.boardId,
            storyId: taskData.storyId,
            columnType: ColumnType.SPECIFICATION,
            subcolumn: SubcolumnType.SPECIFIED,
            title: taskData.title,
            description: taskData.description,
            position: taskData.position,
            priorityScore: taskData.priorityScore,
            priorityConfidence: taskData.priorityConfidence,
            priorityCriteriaJson: taskData.priorityCriteria as unknown as Prisma.InputJsonValue,
            classifiedByModel: taskData.classifiedByModel,
            authorId: taskData.authorId,
          },
          include: { author: { select: { name: true } } },
        });
        created.push(mapTask(row));
      }
      return created;
    });
  }

  public async update(taskId: string, data: UpdateTaskRepoData): Promise<Task> {
    const row = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
      include: { author: { select: { name: true } } },
    });
    return mapTask(row);
  }

  public async updatePriority(taskId: string, data: UpdateTaskPriorityRepoData): Promise<Task> {
    const row = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        priorityScore: data.priorityScore,
        priorityConfidence: data.priorityConfidence,
        priorityCriteriaJson: data.priorityCriteria as unknown as Prisma.InputJsonValue,
        classifiedByModel: data.classifiedByModel,
      },
      include: { author: { select: { name: true } } },
    });
    return mapTask(row);
  }

  public async move(taskId: string, data: MoveTaskRepoData): Promise<Task> {
    const row = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        columnType: data.columnType,
        subcolumn: data.subcolumn,
        position: data.position,
      },
      include: { author: { select: { name: true } } },
    });
    return mapTask(row);
  }

  public async delete(taskId: string): Promise<void> {
    await this.prisma.task.delete({ where: { id: taskId } });
  }
}
