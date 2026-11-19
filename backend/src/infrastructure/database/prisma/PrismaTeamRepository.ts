import { PrismaClient } from '@prisma/client';
import {
  CreatedTeamBundle,
  CreateTeamWithProjectRepoData,
  ITeamRepository,
} from '../../../application/ports/repositories/ITeamRepository';
import {
  ContextFileType,
  Team,
  TeamMember,
  TeamRole,
  TeamSummary,
} from '../../../domain/entities/Team';
import { INITIAL_COLUMN_ORDER } from '../../../domain/value-objects/KanbanStage';

export class PrismaTeamRepository implements ITeamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async createTeamWithProjectAndBoard(
    data: CreateTeamWithProjectRepoData,
  ): Promise<CreatedTeamBundle> {
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: data.teamName,
          inviteCode: data.inviteCode,
          createdById: data.createdById,
          members: {
            create: {
              userId: data.createdById,
              role: TeamRole.OWNER,
            },
          },
          project: {
            create: {
              name: data.projectName,
              contextFileName: data.contextFileName,
              contextFileType: data.contextFileType,
              contextText: data.contextText,
              board: {
                create: {
                  columns: {
                    create: INITIAL_COLUMN_ORDER.map((col) => ({
                      type: col.type,
                      position: col.position,
                      wipLimit: null,
                    })),
                  },
                },
              },
            },
          },
        },
        include: {
          project: {
            include: { board: true },
          },
        },
      });

      const project = team.project!;
      const board = project.board!;

      return {
        team: {
          id: team.id,
          name: team.name,
          inviteCode: team.inviteCode,
          createdById: team.createdById,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
        },
        projectId: project.id,
        boardId: board.id,
      };
    });
  }

  public async findById(teamId: string): Promise<Team | null> {
    return this.prisma.team.findUnique({ where: { id: teamId } });
  }

  public async findByInviteCode(inviteCode: string): Promise<Team | null> {
    return this.prisma.team.findUnique({ where: { inviteCode } });
  }

  public async findMember(teamId: string, userId: string): Promise<TeamMember | null> {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!member) return null;
    return {
      id: member.id,
      teamId: member.teamId,
      userId: member.userId,
      role: member.role as TeamRole,
      joinedAt: member.joinedAt,
      userName: member.user.name,
      userEmail: member.user.email,
    };
  }

  public async addMember(teamId: string, userId: string, role: TeamRole): Promise<TeamMember> {
    const member = await this.prisma.teamMember.create({
      data: { teamId, userId, role },
      include: { user: { select: { name: true, email: true } } },
    });
    return {
      id: member.id,
      teamId: member.teamId,
      userId: member.userId,
      role: member.role as TeamRole,
      joinedAt: member.joinedAt,
      userName: member.user.name,
      userEmail: member.user.email,
    };
  }

  public async listMembers(teamId: string): Promise<TeamMember[]> {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map((member) => ({
      id: member.id,
      teamId: member.teamId,
      userId: member.userId,
      role: member.role as TeamRole,
      joinedAt: member.joinedAt,
      userName: member.user.name,
      userEmail: member.user.email,
    }));
  }

  public async listUserTeams(userId: string): Promise<TeamSummary[]> {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            _count: { select: { members: true } },
            project: {
              include: { board: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships
      .filter((m) => m.team.project && m.team.project.board)
      .map((m) => ({
        team: {
          id: m.team.id,
          name: m.team.name,
          inviteCode: m.team.inviteCode,
          createdById: m.team.createdById,
          createdAt: m.team.createdAt,
          updatedAt: m.team.updatedAt,
        },
        role: m.role as TeamRole,
        projectId: m.team.project!.id,
        projectName: m.team.project!.name,
        boardId: m.team.project!.board!.id,
        memberCount: m.team._count.members,
        contextFileName: m.team.project!.contextFileName,
        contextFileType: m.team.project!.contextFileType as ContextFileType,
      }));
  }

  public async isMemberOfBoard(boardId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.board.count({
      where: {
        id: boardId,
        project: {
          team: {
            members: {
              some: { userId },
            },
          },
        },
      },
    });
    return count > 0;
  }
}
