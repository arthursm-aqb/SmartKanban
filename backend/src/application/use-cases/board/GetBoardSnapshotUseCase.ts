import { ForbiddenError, NotFoundError } from '../../../domain/errors';
import { WipPolicyService } from '../../../domain/services/WipPolicyService';
import { BoardSnapshotOutput } from '../../dtos/BoardDtos';
import { IActivityLogRepository } from '../../ports/repositories/IActivityLogRepository';
import { IBoardRepository } from '../../ports/repositories/IBoardRepository';
import { IProjectRepository } from '../../ports/repositories/IProjectRepository';
import { IStickyNoteRepository } from '../../ports/repositories/IStickyNoteRepository';
import { IStoryRepository } from '../../ports/repositories/IStoryRepository';
import { ITaskRepository } from '../../ports/repositories/ITaskRepository';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';

export class GetBoardSnapshotUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly boardRepository: IBoardRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly stickyNoteRepository: IStickyNoteRepository,
    private readonly activityLogRepository: IActivityLogRepository,
    private readonly wipPolicyService: WipPolicyService,
  ) {}

  public async execute(boardId: string, userId: string): Promise<BoardSnapshotOutput> {
    const isMember = await this.teamRepository.isMemberOfBoard(boardId, userId);
    if (!isMember) {
      throw new ForbiddenError('Você não tem acesso a este quadro Kanban.');
    }

    const project = await this.projectRepository.findByBoardId(boardId);
    if (!project) {
      throw new NotFoundError('Projeto do quadro');
    }

    const team = await this.teamRepository.findById(project.teamId);
    if (!team) {
      throw new NotFoundError('Equipe');
    }

    const [members, columns, stories, tasks, notes, activityLogs] = await Promise.all([
      this.teamRepository.listMembers(team.id),
      this.boardRepository.listColumns(boardId),
      this.storyRepository.listByBoardId(boardId),
      this.taskRepository.listByBoardId(boardId),
      this.stickyNoteRepository.listByBoardId(boardId),
      this.activityLogRepository.listByBoard({ boardId, limit: 50 }),
    ]);

    const wipOccupancy = this.wipPolicyService.calculateAllOccupancies({
      columns,
      stories,
      tasks,
    });

    return {
      boardId,
      team,
      members,
      project: {
        id: project.id,
        name: project.name,
        contextFileName: project.contextFileName,
        contextFileType: project.contextFileType,
        contextText: project.contextText,
      },
      columns,
      wipOccupancy,
      stories,
      tasks,
      notes,
      activityLogs,
    };
  }
}
