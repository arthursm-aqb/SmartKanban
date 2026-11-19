import { Prisma, PrismaClient } from '@prisma/client';
import {
  CreateActivityLogRepoData,
  IActivityLogRepository,
  ListActivityLogsFilter,
} from '../../../application/ports/repositories/IActivityLogRepository';
import {
  ActivityActionType,
  ActivityEntityType,
  ActivityLog,
} from '../../../domain/entities/ActivityLog';

function mapLog(row: {
  id: string;
  boardId: string;
  actorId: string;
  actionType: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadataJson: Prisma.JsonValue;
  createdAt: Date;
  actor?: { name: string };
}): ActivityLog {
  return {
    id: row.id,
    boardId: row.boardId,
    actorId: row.actorId,
    actorName: row.actor?.name,
    actionType: row.actionType as ActivityActionType,
    entityType: row.entityType as ActivityEntityType,
    entityId: row.entityId,
    summary: row.summary,
    metadata: (row.metadataJson as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
  };
}

export class PrismaActivityLogRepository implements IActivityLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: CreateActivityLogRepoData): Promise<ActivityLog> {
    const row = await this.prisma.activityLog.create({
      data: {
        boardId: data.boardId,
        actorId: data.actorId,
        actionType: data.actionType,
        entityType: data.entityType,
        entityId: data.entityId,
        summary: data.summary,
        metadataJson: (data.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
      include: { actor: { select: { name: true } } },
    });
    return mapLog(row);
  }

  public async listByBoard(filter: ListActivityLogsFilter): Promise<ActivityLog[]> {
    const rows = await this.prisma.activityLog.findMany({
      where: {
        boardId: filter.boardId,
        ...(filter.actorId ? { actorId: filter.actorId } : {}),
        ...(filter.actionType ? { actionType: filter.actionType } : {}),
      },
      include: { actor: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
    return rows.map(mapLog);
  }
}
