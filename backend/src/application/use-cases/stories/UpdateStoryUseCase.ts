import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { UserStory } from '../../../domain/entities/UserStory';
import { ForbiddenError, NotFoundError } from '../../../domain/errors';
import { UpdateStoryCommand } from '../../dtos/StoryDtos';
import { IStoryRepository } from '../../ports/repositories/IStoryRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';

export class UpdateStoryUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: UpdateStoryCommand): Promise<{ story: UserStory }> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.actorId);
    if (!isMember) {
      throw new ForbiddenError('Você não é membro da equipe deste quadro.');
    }

    const existing = await this.storyRepository.findById(command.storyId);
    if (!existing || existing.boardId !== command.boardId) {
      throw new NotFoundError('História de usuário');
    }

    const updated = await this.storyRepository.update(existing.id, {
      title: command.title !== undefined ? command.title.trim() : undefined,
      description: command.description !== undefined ? command.description.trim() : undefined,
    });

    this.realtimePublisher.publishToBoard(command.boardId, 'board:story_updated', {
      story: updated,
    });

    await this.recordActivityLog.execute({
      boardId: command.boardId,
      actorId: command.actorId,
      actionType: ActivityActionType.STORY_UPDATED,
      entityType: ActivityEntityType.STORY,
      entityId: updated.id,
      summary: `Editou a história "${updated.title}".`,
      metadata: { previousTitle: existing.title, newTitle: updated.title },
    });

    return { story: updated };
  }
}
