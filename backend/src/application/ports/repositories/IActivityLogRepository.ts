import { ActivityActionType, ActivityEntityType, ActivityLog } from '../../../domain/entities/ActivityLog';

export interface CreateActivityLogRepoData {
  boardId: string;
  actorId: string;
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown> | null;
}

export interface ListActivityLogsFilter {
  boardId: string;
  cursor?: string;
  limit: number;
  actorId?: string;
  actionType?: ActivityActionType;
}

export interface IActivityLogRepository {
  create(data: CreateActivityLogRepoData): Promise<ActivityLog>;
  listByBoard(filter: ListActivityLogsFilter): Promise<ActivityLog[]>;
}
