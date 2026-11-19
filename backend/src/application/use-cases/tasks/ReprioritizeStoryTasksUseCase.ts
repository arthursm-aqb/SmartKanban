import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { Task } from '../../../domain/entities/Task';
import {
  ConflictError,
  DomainValidationError,
  ForbiddenError,
  NotFoundError,
} from '../../../domain/errors';
import { SubcolumnType } from '../../../domain/value-objects/KanbanStage';
import { ReprioritizeStoryTasksCommand } from '../../dtos/TaskDtos';
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

export class ReprioritizeStoryTasksUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly priorityClassifier: IPriorityClassifier,
    private readonly rateLimiter: IRateLimiter,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: ReprioritizeStoryTasksCommand): Promise<{ tasks: Task[] }> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.actorId);
    if (!isMember) {
      throw new ForbiddenError('Você não é membro da equipe deste quadro.');
    }

    const lockKey = `story_generate:${command.storyId}`;
    if (!this.rateLimiter.acquireLock(lockKey)) {
      throw new ConflictError('Já existe uma classificação em andamento para esta história.');
    }

    try {
      const story = await this.storyRepository.findById(command.storyId);
      if (!story || story.boardId !== command.boardId) {
        throw new NotFoundError('História de usuário');
      }

      const storyTasks = (await this.taskRepository.listByStoryId(story.id)).filter(
        (t) => t.subcolumn === SubcolumnType.SPECIFIED,
      );
      if (storyTasks.length === 0) {
        throw new DomainValidationError(
          'Não há tarefas na subcoluna "Especificado" para reclassificar nesta história.',
        );
      }

      const project = await this.projectRepository.findByBoardId(command.boardId);
      if (!project) {
        throw new NotFoundError('Projeto do quadro');
      }

      const [allStories, allTasks] = await Promise.all([
        this.storyRepository.listByBoardId(command.boardId),
        this.taskRepository.listByBoardId(command.boardId),
      ]);

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

      const classifications = await this.priorityClassifier.classify(
        context,
        storyTasks.map((t) => ({ title: t.title, description: t.description })),
      );
      const classificationByIndex = new Map(classifications.map((c) => [c.taskIndex, c]));

      const updatedTasks: Task[] = [];
      for (let i = 0; i < storyTasks.length; i += 1) {
        const task = storyTasks[i]!;
        const result = classificationByIndex.get(i);
        if (!result) continue;

        const updated = await this.taskRepository.updatePriority(task.id, {
          priorityScore: result.priority.value,
          priorityConfidence: result.priority.confidence,
          priorityCriteria: result.priority.criteria,
          classifiedByModel: result.classifiedByModel,
        });
        updatedTasks.push(updated);
      }

      this.realtimePublisher.publishToBoard(command.boardId, 'board:tasks_reprioritized', {
        storyId: story.id,
        tasks: updatedTasks,
      });

      await this.recordActivityLog.execute({
        boardId: command.boardId,
        actorId: command.actorId,
        actionType: ActivityActionType.TASKS_REPRIORITIZED,
        entityType: ActivityEntityType.STORY,
        entityId: story.id,
        summary: `Reclassificou ${updatedTasks.length} tarefa(s) da história "${story.title}" via Gemini Decisions.`,
        metadata: {
          storyId: story.id,
          priorities: updatedTasks.map((t) => ({ id: t.id, priorityScore: t.priorityScore })),
        },
      });

      return { tasks: updatedTasks };
    } finally {
      this.rateLimiter.releaseLock(lockKey);
    }
  }
}
