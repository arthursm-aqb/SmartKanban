import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { Task } from '../../../domain/entities/Task';
import { ForbiddenError, NotFoundError } from '../../../domain/errors';
import { UpdateTaskCommand } from '../../dtos/TaskDtos';
import { ITaskRepository } from '../../ports/repositories/ITaskRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';

export class UpdateTaskUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: UpdateTaskCommand): Promise<{ task: Task }> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.actorId);
    if (!isMember) {
      throw new ForbiddenError('Você não é membro da equipe deste quadro.');
    }

    const existing = await this.taskRepository.findById(command.taskId);
    if (!existing || existing.boardId !== command.boardId) {
      throw new NotFoundError('Tarefa');
    }

    const updated = await this.taskRepository.update(existing.id, {
      title: command.title !== undefined ? command.title.trim() : undefined,
      description: command.description !== undefined ? command.description.trim() : undefined,
    });

    this.realtimePublisher.publishToBoard(command.boardId, 'board:task_updated', {
      task: updated,
    });

    await this.recordActivityLog.execute({
      boardId: command.boardId,
      actorId: command.actorId,
      actionType: ActivityActionType.TASK_UPDATED,
      entityType: ActivityEntityType.TASK,
      entityId: updated.id,
      summary: `Editou a tarefa "${updated.title}".`,
      metadata: { storyId: updated.storyId, previousTitle: existing.title },
    });

    return { task: updated };
  }
}
