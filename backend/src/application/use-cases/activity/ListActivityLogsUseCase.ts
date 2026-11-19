import { ActivityLog } from '../../../domain/entities/ActivityLog';
import { ForbiddenError } from '../../../domain/errors';
import { ListActivityLogsCommand } from '../../dtos/ActivityLogDtos';
import { IActivityLogRepository } from '../../ports/repositories/IActivityLogRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';

export class ListActivityLogsUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly activityLogRepository: IActivityLogRepository,
  ) {}

  public async execute(command: ListActivityLogsCommand): Promise<ActivityLog[]> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.userId);
    if (!isMember) {
      throw new ForbiddenError('Você não é membro da equipe deste quadro.');
    }

    return this.activityLogRepository.listByBoard({
      boardId: command.boardId,
      cursor: command.cursor,
      limit: command.limit ?? 50,
      actorId: command.actorId,
      actionType: command.actionType,
    });
  }
}
