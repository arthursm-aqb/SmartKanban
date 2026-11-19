import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { BoardColumn } from '../../../domain/entities/BoardColumn';
import { ForbiddenError } from '../../../domain/errors';
import { ColumnWipOccupancy, WipPolicyService } from '../../../domain/services/WipPolicyService';
import { COLUMN_LABELS, ColumnType } from '../../../domain/value-objects/KanbanStage';
import { WipLimit } from '../../../domain/value-objects/WipLimit';
import { UpdateColumnWipCommand } from '../../dtos/BoardDtos';
import { IBoardRepository } from '../../ports/repositories/IBoardRepository';
import { IStoryRepository } from '../../ports/repositories/IStoryRepository';
import { ITaskRepository } from '../../ports/repositories/ITaskRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';

export interface UpdateColumnWipResult {
  column: BoardColumn;
  wipOccupancy: Record<ColumnType, ColumnWipOccupancy>;
}

export class UpdateColumnWipUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly boardRepository: IBoardRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly wipPolicyService: WipPolicyService,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: UpdateColumnWipCommand): Promise<UpdateColumnWipResult> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.actorId);
    if (!isMember) {
      throw new ForbiddenError('Você não tem permissão para alterar o limite WIP deste quadro.');
    }

    const validatedLimit = WipLimit.create(command.wipLimit).value;
    const updatedColumn = await this.boardRepository.updateColumnWipLimit(
      command.boardId,
      command.columnType,
      validatedLimit,
    );

    const [columns, stories, tasks] = await Promise.all([
      this.boardRepository.listColumns(command.boardId),
      this.storyRepository.listByBoardId(command.boardId),
      this.taskRepository.listByBoardId(command.boardId),
    ]);

    const wipOccupancy = this.wipPolicyService.calculateAllOccupancies({ columns, stories, tasks });

    this.realtimePublisher.publishToBoard(command.boardId, 'board:wip_updated', {
      column: updatedColumn,
      wipOccupancy,
    });

    const limitDescription =
      validatedLimit === null ? 'sem limite' : `limite ${validatedLimit}`;
    await this.recordActivityLog.execute({
      boardId: command.boardId,
      actorId: command.actorId,
      actionType: ActivityActionType.WIP_UPDATED,
      entityType: ActivityEntityType.BOARD_COLUMN,
      entityId: updatedColumn.id,
      summary: `Definiu WIP da coluna "${COLUMN_LABELS[command.columnType]}" como ${limitDescription}.`,
      metadata: { columnType: command.columnType, wipLimit: validatedLimit },
    });

    return { column: updatedColumn, wipOccupancy };
  }
}
