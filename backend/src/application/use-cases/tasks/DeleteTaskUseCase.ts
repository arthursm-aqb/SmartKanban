import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { ForbiddenError, NotFoundError } from '../../../domain/errors';
import { ColumnWipOccupancy, WipPolicyService } from '../../../domain/services/WipPolicyService';
import { ColumnType } from '../../../domain/value-objects/KanbanStage';
import { DeleteTaskCommand } from '../../dtos/TaskDtos';
import { IBoardRepository } from '../../ports/repositories/IBoardRepository';
import { IStoryRepository } from '../../ports/repositories/IStoryRepository';
import { ITaskRepository } from '../../ports/repositories/ITaskRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';

export interface DeleteTaskResult {
  taskId: string;
  storyId: string;
  wipOccupancy: Record<ColumnType, ColumnWipOccupancy>;
}

export class DeleteTaskUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly boardRepository: IBoardRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly wipPolicyService: WipPolicyService,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: DeleteTaskCommand): Promise<DeleteTaskResult> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.actorId);
    if (!isMember) {
      throw new ForbiddenError('Você não é membro da equipe deste quadro.');
    }

    const existing = await this.taskRepository.findById(command.taskId);
    if (!existing || existing.boardId !== command.boardId) {
      throw new NotFoundError('Tarefa');
    }

    await this.taskRepository.delete(existing.id);

    const [columns, stories, tasks] = await Promise.all([
      this.boardRepository.listColumns(command.boardId),
      this.storyRepository.listByBoardId(command.boardId),
      this.taskRepository.listByBoardId(command.boardId),
    ]);

    const wipOccupancy = this.wipPolicyService.calculateAllOccupancies({ columns, stories, tasks });

    this.realtimePublisher.publishToBoard(command.boardId, 'board:task_deleted', {
      taskId: existing.id,
      storyId: existing.storyId,
      wipOccupancy,
    });

    await this.recordActivityLog.execute({
      boardId: command.boardId,
      actorId: command.actorId,
      actionType: ActivityActionType.TASK_DELETED,
      entityType: ActivityEntityType.TASK,
      entityId: existing.id,
      summary: `Removeu a tarefa "${existing.title}".`,
      metadata: { storyId: existing.storyId, subcolumn: existing.subcolumn },
    });

    return { taskId: existing.id, storyId: existing.storyId, wipOccupancy };
  }
}
