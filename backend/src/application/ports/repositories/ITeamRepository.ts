import { ContextFileType, Team, TeamMember, TeamRole, TeamSummary } from '../../../domain/entities/Team';

export interface CreateTeamWithProjectRepoData {
  teamName: string;
  inviteCode: string;
  createdById: string;
  projectName: string;
  contextFileName: string;
  contextFileType: ContextFileType;
  contextText: string;
}

export interface CreatedTeamBundle {
  team: Team;
  projectId: string;
  boardId: string;
}

export interface ITeamRepository {
  createTeamWithProjectAndBoard(data: CreateTeamWithProjectRepoData): Promise<CreatedTeamBundle>;
  findById(teamId: string): Promise<Team | null>;
  findByInviteCode(inviteCode: string): Promise<Team | null>;
  findMember(teamId: string, userId: string): Promise<TeamMember | null>;
  addMember(teamId: string, userId: string, role: TeamRole): Promise<TeamMember>;
  listMembers(teamId: string): Promise<TeamMember[]>;
  listUserTeams(userId: string): Promise<TeamSummary[]>;
  isMemberOfBoard(boardId: string, userId: string): Promise<boolean>;
}
