import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { StickyNote } from '../../../domain/entities/StickyNote';
import { ForbiddenError, NotFoundError } from '../../../domain/errors';
import { UpdateStickyNoteCommand } from '../../dtos/StickyNoteDtos';
import { IStickyNoteRepository } from '../../ports/repositories/IStickyNoteRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';

export class UpdateStickyNoteUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly stickyNoteRepository: IStickyNoteRepository,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: UpdateStickyNoteCommand): Promise<{ note: StickyNote }> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.actorId);
    if (!isMember) {
      throw new ForbiddenError('Você não é membro da equipe deste quadro.');
    }

    const existing = await this.stickyNoteRepository.findById(command.noteId);
    if (!existing || existing.boardId !== command.boardId) {
      throw new NotFoundError('Post-it');
    }

    const updated = await this.stickyNoteRepository.update(existing.id, {
      content: command.content !== undefined ? command.content.trim() : undefined,
      color: command.color,
      posX: command.posX,
      posY: command.posY,
    });

    this.realtimePublisher.publishToBoard(command.boardId, 'board:note_updated', { note: updated });

    await this.recordActivityLog.execute({
      boardId: command.boardId,
      actorId: command.actorId,
      actionType: ActivityActionType.NOTE_UPDATED,
      entityType: ActivityEntityType.STICKY_NOTE,
      entityId: updated.id,
      summary: `Atualizou um post-it no quadro de anotações.`,
      metadata: { color: updated.color },
    });

    return { note: updated };
  }
}
