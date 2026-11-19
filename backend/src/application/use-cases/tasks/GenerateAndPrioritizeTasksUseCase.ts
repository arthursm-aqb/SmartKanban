import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { Task } from '../../../domain/entities/Task';
import { UserStory } from '../../../domain/entities/UserStory';
import {
  ConflictError,
  DomainValidationError,
  ForbiddenError,
  NotFoundError,
} from '../../../domain/errors';
import { ColumnWipOccupancy, WipPolicyService } from '../../../domain/services/WipPolicyService';
import { ColumnType, SubcolumnType } from '../../../domain/value-objects/KanbanStage';
import { GenerateTasksCommand } from '../../dtos/TaskDtos';
import { IBoardRepository } from '../../ports/repositories/IBoardRepository';
import { IProjectRepository } from '../../ports/repositories/IProjectRepository';
import { IStoryRepository } from '../../ports/repositories/IStoryRepository';
import { ITaskRepository } from '../../ports/repositories/ITaskRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import {
  BoardContextSummary,
  IPriorityClassifier,
} from '../../ports/services/IPriorityClassifier';
import { IRateLimiter } from '../../ports/services/IRateLimiter';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';

export interface GenerateTasksResult {
  story: UserStory;
  tasks: Task[];
  wipOccupancy: Record<ColumnType, ColumnWipOccupancy>;
}

export class GenerateAndPrioritizeTasksUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly boardRepository: IBoardRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly priorityClassifier: IPriorityClassifier,
    private readonly wipPolicyService: WipPolicyService,
    private readonly rateLimiter: IRateLimiter,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: GenerateTasksCommand): Promise<GenerateTasksResult> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.actorId);
    if (!isMember) {
      throw new ForbiddenError('Você não é membro da equipe deste quadro.');
    }

    if (command.tasks.length === 0) {
      throw new DomainValidationError('Informe pelo menos uma tarefa para gerar a linha em Especificado.');
    }

    const lockKey = `story_generate:${command.storyId}`;
    const lockAcquired = this.rateLimiter.acquireLock(lockKey);
    if (!lockAcquired) {
      throw new ConflictError('Já existe uma geração de tarefas em andamento para esta história.');
    }

    try {
      const story = await this.storyRepository.findById(command.storyId);
      if (!story || story.boardId !== command.boardId) {
        throw new NotFoundError('História de usuário');
      }

      if (story.subcolumn !== SubcolumnType.IN_SPECIFICATION) {
        throw new DomainValidationError(
          'Tarefas só podem ser geradas a partir de uma história na subcoluna "Em especificação".',
        );
      }

      const project = await this.projectRepository.findByBoardId(command.boardId);
      if (!project) {
        throw new NotFoundError('Projeto do quadro');
      }

      const [columns, allStories, allTasks] = await Promise.all([
        this.boardRepository.listColumns(command.boardId),
        this.storyRepository.listByBoardId(command.boardId),
        this.taskRepository.listByBoardId(command.boardId),
      ]);

      const normalizedDrafts = command.tasks.map((draft) => ({
        title: draft.title.trim(),
        description: (draft.description ?? '').trim(),
      }));

      const context: BoardContextSummary = {
        projectName: project.name,
        contextDocumentText: project.contextText,
        storyTitle: story.title,
        storyDescription: story.description,
        existingBacklogCount: allStories.filter((s) => s.subcolumn === SubcolumnType.BACKLOG).length,
        inSpecificationCount: allStories.filter((s) => s.subcolumn === SubcolumnType.IN_SPECIFICATION)
          .length,
        specifiedTasksCount: allTasks.filter((t) => t.subcolumn === SubcolumnType.SPECIFIED).length,
        inImplementationCount: allTasks.filter(
          (t) =>
            t.subcolumn === SubcolumnType.IN_IMPLEMENTATION ||
            t.subcolumn === SubcolumnType.IMPLEMENTED,
        ).length,
        inReviewCount: allTasks.filter((t) => t.subcolumn === SubcolumnType.IN_REVIEW).length,
        existingStoryTitles: allStories.map((s) => s.title),
      };

      const classifications = await this.priorityClassifier.classify(context, normalizedDrafts);
      const classificationByIndex = new Map(classifications.map((c) => [c.taskIndex, c]));

      const tasksToCreate = normalizedDrafts.map((draft, index) => {
        const result = classificationByIndex.get(index);
        if (!result) {
          throw new DomainValidationError(`Classificação ausente para a tarefa de índice ${index}.`);
        }
        return {
          boardId: command.boardId,
          storyId: story.id,
          title: draft.title,
          description: draft.description,
          position: index,
          priorityScore: result.priority.value,
          priorityConfidence: result.priority.confidence,
          priorityCriteria: result.priority.criteria,
          classifiedByModel: result.classifiedByModel,
          authorId: command.actorId,
        };
      });

      const createdTasks = await this.taskRepository.createManyAndMarkStorySpecified(
        story.id,
        tasksToCreate,
      );

      const updatedStory: UserStory = {
        ...story,
        columnType: ColumnType.SPECIFICATION,
        subcolumn: SubcolumnType.SPECIFIED,
        updatedAt: new Date(),
      };

      const nextStories = allStories.map((s) => (s.id === updatedStory.id ? updatedStory : s));
      const nextTasks = [...allTasks, ...createdTasks];

      const wipOccupancy = this.wipPolicyService.calculateAllOccupancies({
        columns,
        stories: nextStories,
        tasks: nextTasks,
      });

      this.realtimePublisher.publishToBoard(command.boardId, 'board:tasks_generated', {
        story: updatedStory,
        tasks: createdTasks,
        wipOccupancy,
      });

      const modelUsed = createdTasks[0]?.classifiedByModel ?? 'unknown';
      await this.recordActivityLog.execute({
        boardId: command.boardId,
        actorId: command.actorId,
        actionType: ActivityActionType.TASKS_GENERATED,
        entityType: ActivityEntityType.STORY,
        entityId: story.id,
        summary: `Gerou ${createdTasks.length} tarefa(s) em "Especificado" a partir da história "${story.title}" (classificadas por ${modelUsed}).`,
        metadata: {
          storyId: story.id,
          taskCount: createdTasks.length,
          classifiedByModel: modelUsed,
          priorities: createdTasks.map((t) => ({
            id: t.id,
            title: t.title,
            priorityScore: t.priorityScore,
            confidence: t.priorityConfidence,
          })),
        },
      });

      return {
        story: updatedStory,
        tasks: createdTasks,
        wipOccupancy,
      };
    } finally {
      this.rateLimiter.releaseLock(lockKey);
    }
  }
}
