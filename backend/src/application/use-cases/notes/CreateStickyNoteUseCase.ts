import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { StickyNote } from '../../../domain/entities/StickyNote';
import { ForbiddenError } from '../../../domain/errors';
import { CreateStickyNoteCommand } from '../../dtos/StickyNoteDtos';
import { IStickyNoteRepository } from '../../ports/repositories/IStickyNoteRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';

export class CreateStickyNoteUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly stickyNoteRepository: IStickyNoteRepository,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: CreateStickyNoteCommand): Promise<{ note: StickyNote }> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.actorId);
    if (!isMember) {
      throw new ForbiddenError('Você não é membro da equipe deste quadro.');
    }

    const note = await this.stickyNoteRepository.create({
      boardId: command.boardId,
      content: command.content.trim(),
      color: command.color,
      posX: command.posX,
      posY: command.posY,
      authorId: command.actorId,
    });

    this.realtimePublisher.publishToBoard(command.boardId, 'board:note_created', { note });

    await this.recordActivityLog.execute({
      boardId: command.boardId,
      actorId: command.actorId,
      actionType: ActivityActionType.NOTE_CREATED,
      entityType: ActivityEntityType.STICKY_NOTE,
      entityId: note.id,
      summary: `Adicionou um post-it no quadro de anotações.`,
      metadata: { color: note.color },
    });

    return { note };
  }
}
