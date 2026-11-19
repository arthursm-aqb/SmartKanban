import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { Task } from '../../../domain/entities/Task';
import { DomainValidationError, ForbiddenError, NotFoundError } from '../../../domain/errors';
import { ColumnWipOccupancy, WipPolicyService } from '../../../domain/services/WipPolicyService';
import {
  ColumnType,
  SUBCOLUMN_LABELS,
  SubcolumnType,
  TASK_ALLOWED_SUBCOLUMNS,
  getParentColumn,
} from '../../../domain/value-objects/KanbanStage';
import { MoveTaskCommand } from '../../dtos/TaskDtos';
import { IBoardRepository } from '../../ports/repositories/IBoardRepository';
import { IStoryRepository } from '../../ports/repositories/IStoryRepository';
import { ITaskRepository } from '../../ports/repositories/ITaskRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';

export interface MoveTaskResult {
  task: Task;
  wipOccupancy: Record<ColumnType, ColumnWipOccupancy>;
}

export class MoveTaskUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly boardRepository: IBoardRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly wipPolicyService: WipPolicyService,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: MoveTaskCommand): Promise<MoveTaskResult> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.actorId);
    if (!isMember) {
      throw new ForbiddenError('Você não é membro da equipe deste quadro.');
    }

    if (!TASK_ALLOWED_SUBCOLUMNS.has(command.toSubcolumn)) {
      throw new DomainValidationError(
        'Tarefas só podem ser movidas entre Especificado, Implementação e Revisão de Código.',
      );
    }

    const existing = await this.taskRepository.findById(command.taskId);
    if (!existing || existing.boardId !== command.boardId) {
      throw new NotFoundError('Tarefa');
    }

    if (
      existing.subcolumn === SubcolumnType.REVIEWED &&
      command.toSubcolumn !== SubcolumnType.REVIEWED
    ) {
      throw new DomainValidationError(
        'Tarefas já concluídas na subcoluna "Revisado" não podem retornar para etapas anteriores.',
      );
    }

    const [columns, stories, tasks] = await Promise.all([
      this.boardRepository.listColumns(command.boardId),
      this.storyRepository.listByBoardId(command.boardId),
      this.taskRepository.listByBoardId(command.boardId),
    ]);

    this.wipPolicyService.assertCanMoveTask(existing, command.toSubcolumn, {
      columns,
      stories,
      tasks,
    });

    const targetColumn = getParentColumn(command.toSubcolumn);
    const moved = await this.taskRepository.move(existing.id, {
      columnType: targetColumn,
      subcolumn: command.toSubcolumn,
      position: command.position,
    });

    const updatedTasks = tasks.map((task) => (task.id === moved.id ? moved : task));
    const wipOccupancy = this.wipPolicyService.calculateAllOccupancies({
      columns,
      stories,
      tasks: updatedTasks,
    });

    this.realtimePublisher.publishToBoard(command.boardId, 'board:task_moved', {
      task: moved,
      fromSubcolumn: existing.subcolumn,
      toSubcolumn: moved.subcolumn,
      wipOccupancy,
    });

    await this.recordActivityLog.execute({
      boardId: command.boardId,
      actorId: command.actorId,
      actionType: ActivityActionType.TASK_MOVED,
      entityType: ActivityEntityType.TASK,
      entityId: moved.id,
      summary: `Moveu a tarefa "${moved.title}" de "${SUBCOLUMN_LABELS[existing.subcolumn]}" para "${SUBCOLUMN_LABELS[moved.subcolumn]}".`,
      metadata: {
        storyId: moved.storyId,
        fromSubcolumn: existing.subcolumn,
        toSubcolumn: moved.subcolumn,
        position: moved.position,
      },
    });

    return { task: moved, wipOccupancy };
  }
}
