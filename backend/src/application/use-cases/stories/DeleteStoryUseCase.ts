import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { ForbiddenError, NotFoundError } from '../../../domain/errors';
import { ColumnWipOccupancy, WipPolicyService } from '../../../domain/services/WipPolicyService';
import { ColumnType } from '../../../domain/value-objects/KanbanStage';
import { DeleteStoryCommand } from '../../dtos/StoryDtos';
import { IBoardRepository } from '../../ports/repositories/IBoardRepository';
import { IStoryRepository } from '../../ports/repositories/IStoryRepository';
import { ITaskRepository } from '../../ports/repositories/ITaskRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';

export interface DeleteStoryResult {
  storyId: string;
  wipOccupancy: Record<ColumnType, ColumnWipOccupancy>;
}

export class DeleteStoryUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly boardRepository: IBoardRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly wipPolicyService: WipPolicyService,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: DeleteStoryCommand): Promise<DeleteStoryResult> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.actorId);
    if (!isMember) {
      throw new ForbiddenError('Você não é membro da equipe deste quadro.');
    }

    const existing = await this.storyRepository.findById(command.storyId);
    if (!existing || existing.boardId !== command.boardId) {
      throw new NotFoundError('História de usuário');
    }

    await this.storyRepository.delete(existing.id);

    const [columns, stories, tasks] = await Promise.all([
      this.boardRepository.listColumns(command.boardId),
      this.storyRepository.listByBoardId(command.boardId),
      this.taskRepository.listByBoardId(command.boardId),
    ]);

    const wipOccupancy = this.wipPolicyService.calculateAllOccupancies({ columns, stories, tasks });

    this.realtimePublisher.publishToBoard(command.boardId, 'board:story_deleted', {
      storyId: existing.id,
      wipOccupancy,
    });

    await this.recordActivityLog.execute({
      boardId: command.boardId,
      actorId: command.actorId,
      actionType: ActivityActionType.STORY_DELETED,
      entityType: ActivityEntityType.STORY,
      entityId: existing.id,
      summary: `Removeu a história "${existing.title}".`,
      metadata: { subcolumn: existing.subcolumn },
    });

    return { storyId: existing.id, wipOccupancy };
  }
}
