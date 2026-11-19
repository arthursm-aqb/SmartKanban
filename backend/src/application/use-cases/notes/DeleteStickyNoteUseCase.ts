import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { ForbiddenError, NotFoundError } from '../../../domain/errors';
import { DeleteStickyNoteCommand } from '../../dtos/StickyNoteDtos';
import { IStickyNoteRepository } from '../../ports/repositories/IStickyNoteRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';

export class DeleteStickyNoteUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly stickyNoteRepository: IStickyNoteRepository,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: DeleteStickyNoteCommand): Promise<{ noteId: string }> {
    const isMember = await this.teamRepository.isMemberOfBoard(command.boardId, command.actorId);
    if (!isMember) {
      throw new ForbiddenError('Você não é membro da equipe deste quadro.');
    }

    const existing = await this.stickyNoteRepository.findById(command.noteId);
    if (!existing || existing.boardId !== command.boardId) {
      throw new NotFoundError('Post-it');
    }

    await this.stickyNoteRepository.delete(existing.id);

    this.realtimePublisher.publishToBoard(command.boardId, 'board:note_deleted', {
      noteId: existing.id,
    });

    await this.recordActivityLog.execute({
      boardId: command.boardId,
      actorId: command.actorId,
      actionType: ActivityActionType.NOTE_DELETED,
      entityType: ActivityEntityType.STICKY_NOTE,
      entityId: existing.id,
      summary: `Removeu um post-it do quadro de anotações.`,
      metadata: null,
    });

    return { noteId: existing.id };
  }
}
