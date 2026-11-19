import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { TeamRole } from '../../../domain/entities/Team';
import { ConflictError, NotFoundError } from '../../../domain/errors';
import { InviteCode } from '../../../domain/value-objects/InviteCode';
import { JoinTeamCommand, JoinTeamOutput } from '../../dtos/TeamDtos';
import { IBoardRepository } from '../../ports/repositories/IBoardRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import { IRealtimePublisher } from '../../ports/services/IRealtimePublisher';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';

export class JoinTeamByInviteUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly boardRepository: IBoardRepository,
    private readonly realtimePublisher: IRealtimePublisher,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(command: JoinTeamCommand): Promise<JoinTeamOutput> {
    const inviteCode = InviteCode.create(command.inviteCode).value;
    const team = await this.teamRepository.findByInviteCode(inviteCode);
    if (!team) {
      throw new NotFoundError('Equipe para o código de convite informado');
    }

    const existingMember = await this.teamRepository.findMember(team.id, command.userId);
    if (existingMember) {
      throw new ConflictError('Você já faz parte desta equipe.');
    }

    const member = await this.teamRepository.addMember(team.id, command.userId, TeamRole.MEMBER);
    const board = await this.boardRepository.findByTeamId(team.id);
    if (!board) {
      throw new NotFoundError('Quadro Kanban da equipe');
    }

    this.realtimePublisher.publishToBoard(board.id, 'board:member_joined', { member });

    await this.recordActivityLog.execute({
      boardId: board.id,
      actorId: command.userId,
      actionType: ActivityActionType.MEMBER_JOINED,
      entityType: ActivityEntityType.TEAM,
      entityId: team.id,
      summary: `Entrou na equipe "${team.name}" por meio de convite.`,
      metadata: { memberId: member.id },
    });

    return { team, boardId: board.id };
  }
}
