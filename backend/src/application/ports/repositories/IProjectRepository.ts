import { Project } from '../../../domain/entities/Project';

export interface IProjectRepository {
  findByTeamId(teamId: string): Promise<Project | null>;
  findByBoardId(boardId: string): Promise<Project | null>;
}
