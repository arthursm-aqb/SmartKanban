import { ActivityLog } from '../../../domain/entities/ActivityLog';
import { CreateActivityLogRepoData, IActivityLogRepository } from '../../ports/repositories/IActivityLogRepository';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';

export class RecordActivityLogUseCase {
  constructor(
    private readonly activityLogRepository: IActivityLogRepository,
    private readonly realtimePublisher: IRealtimePublisher,
  ) {}

  public async execute(data: CreateActivityLogRepoData): Promise<ActivityLog> {
    const log = await this.activityLogRepository.create(data);
    this.realtimePublisher.publishToBoard(data.boardId, 'board:activity_logged', { log });
    return log;
  }
}
