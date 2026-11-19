import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { UserStory } from '../../../domain/entities/UserStory';
import { ForbiddenError } from '../../../domain/errors';
import { ColumnWipOccupancy, WipPolicyService } from '../../../domain/services/WipPolicyService';
import { ColumnType, SubcolumnType } from '../../../domain/value-objects/KanbanStage';
import { CreateStoryCommand } from '../../dtos/StoryDtos';
import { IBoardRepository } from '../../ports/repositories/IBoardRepository';
import { IStoryRepository } from '../../ports/repositories/IStoryRepository';
import { ITaskRepository } from '../../ports/repositories/ITaskRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';

export interface StoryMutationResult {
  story: UserStory;
  wipOccupancy: Record<ColumnType, ColumnWipOccupancy>;
}

export class CreateStoryUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly boardRepository: IBoardRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly wipPolicyService: WipPolicyService,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: CreateStoryCommand): Promise<StoryMutationResult> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.actorId);
    if (!isMember) {
      throw new ForbiddenError('Você não é membro da equipe deste quadro.');
    }

    const [columns, stories, tasks] = await Promise.all([
      this.boardRepository.listColumns(command.boardId),
      this.storyRepository.listByBoardId(command.boardId),
      this.taskRepository.listByBoardId(command.boardId),
    ]);

    this.wipPolicyService.assertCanCreateStoryInBacklog({ columns, stories, tasks });

    const backlogCount = stories.filter((s) => s.subcolumn === SubcolumnType.BACKLOG).length;
    const story = await this.storyRepository.create({
      boardId: command.boardId,
      title: command.title.trim(),
      description: (command.description ?? '').trim(),
      authorId: command.actorId,
      position: backlogCount,
    });

    const wipOccupancy = this.wipPolicyService.calculateAllOccupancies({
      columns,
      stories: [...stories, story],
      tasks,
    });

    this.realtimePublisher.publishToBoard(command.boardId, 'board:story_created', {
      story,
      wipOccupancy,
    });

    await this.recordActivityLog.execute({
      boardId: command.boardId,
      actorId: command.actorId,
      actionType: ActivityActionType.STORY_CREATED,
      entityType: ActivityEntityType.STORY,
      entityId: story.id,
      summary: `Criou a história "${story.title}" no Backlog.`,
      metadata: { subcolumn: story.subcolumn },
    });

    return { story, wipOccupancy };
  }
}
