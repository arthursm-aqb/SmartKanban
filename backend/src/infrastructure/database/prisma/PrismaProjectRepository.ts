import { PrismaClient } from '@prisma/client';
import { IProjectRepository } from '../../../application/ports/repositories/IProjectRepository';
import { Project } from '../../../domain/entities/Project';
import { ContextFileType } from '../../../domain/entities/Team';

export class PrismaProjectRepository implements IProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findByTeamId(teamId: string): Promise<Project | null> {
    const project = await this.prisma.project.findUnique({ where: { teamId } });
    if (!project) return null;
    return {
      ...project,
      contextFileType: project.contextFileType as ContextFileType,
    };
  }

  public async findByBoardId(boardId: string): Promise<Project | null> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: { project: true },
    });
    if (!board?.project) return null;
    return {
      ...board.project,
      contextFileType: board.project.contextFileType as ContextFileType,
    };
  }
}
