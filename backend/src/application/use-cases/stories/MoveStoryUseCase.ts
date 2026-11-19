import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { DomainValidationError, ForbiddenError, NotFoundError } from '../../../domain/errors';
import { WipPolicyService } from '../../../domain/services/WipPolicyService';
import {
  STORY_MOVABLE_SUBCOLUMNS,
  SUBCOLUMN_LABELS,
  SubcolumnType,
  getParentColumn,
} from '../../../domain/value-objects/KanbanStage';
import { MoveStoryCommand } from '../../dtos/StoryDtos';
import { IBoardRepository } from '../../ports/repositories/IBoardRepository';
import { IStoryRepository } from '../../ports/repositories/IStoryRepository';
import { ITaskRepository } from '../../ports/repositories/ITaskRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';
import { StoryMutationResult } from './CreateStoryUseCase';

export class MoveStoryUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly boardRepository: IBoardRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly wipPolicyService: WipPolicyService,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: MoveStoryCommand): Promise<StoryMutationResult> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.actorId);
    if (!isMember) {
      throw new ForbiddenError('Você não é membro da equipe deste quadro.');
    }

    if (!STORY_MOVABLE_SUBCOLUMNS.has(command.toSubcolumn)) {
      throw new DomainValidationError(
        'Histórias de usuário só podem ser movidas entre Backlog e Em especificação. Para avançar para Especificado, gere as tarefas no pop-up.',
      );
    }

    const existing = await this.storyRepository.findById(command.storyId);
    if (!existing || existing.boardId !== command.boardId) {
      throw new NotFoundError('História de usuário');
    }

    if (existing.subcolumn === SubcolumnType.SPECIFIED) {
      throw new DomainValidationError(
        'Histórias já especificadas possuem linha de tarefas e não podem ser movidas diretamente como card de história.',
      );
    }

    const [columns, stories, tasks] = await Promise.all([
      this.boardRepository.listColumns(command.boardId),
      this.storyRepository.listByBoardId(command.boardId),
      this.taskRepository.listByBoardId(command.boardId),
    ]);

    this.wipPolicyService.assertCanMoveStory(existing, command.toSubcolumn, {
      columns,
      stories,
      tasks,
    });

    const targetColumn = getParentColumn(command.toSubcolumn);
    const moved = await this.storyRepository.move(existing.id, {
      columnType: targetColumn,
      subcolumn: command.toSubcolumn,
      position: command.position,
    });

    const updatedStories = stories.map((story) => (story.id === moved.id ? moved : story));
    const wipOccupancy = this.wipPolicyService.calculateAllOccupancies({
      columns,
      stories: updatedStories,
      tasks,
    });

    this.realtimePublisher.publishToBoard(command.boardId, 'board:story_moved', {
      story: moved,
      fromSubcolumn: existing.subcolumn,
      toSubcolumn: moved.subcolumn,
      wipOccupancy,
    });

    await this.recordActivityLog.execute({
      boardId: command.boardId,
      actorId: command.actorId,
      actionType: ActivityActionType.STORY_MOVED,
      entityType: ActivityEntityType.STORY,
      entityId: moved.id,
      summary: `Moveu a história "${moved.title}" de "${SUBCOLUMN_LABELS[existing.subcolumn]}" para "${SUBCOLUMN_LABELS[moved.subcolumn]}".`,
      metadata: {
        fromSubcolumn: existing.subcolumn,
        toSubcolumn: moved.subcolumn,
        position: moved.position,
      },
    });

    return { story: moved, wipOccupancy };
  }
}
