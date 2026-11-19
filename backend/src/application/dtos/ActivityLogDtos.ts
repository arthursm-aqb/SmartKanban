import { ActivityActionType } from '../../domain/entities/ActivityLog';

export interface ListActivityLogsInput {
  cursor?: string;
  limit?: number;
  actorId?: string;
  actionType?: ActivityActionType;
}

export interface ListActivityLogsCommand extends ListActivityLogsInput {
  boardId: string;
  userId: string;
}
