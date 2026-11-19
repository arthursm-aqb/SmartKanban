import { Team, TeamSummary } from '../../domain/entities/Team';
import { UploadedDocument } from '../ports/services/IDocumentParser';

export interface CreateTeamTextFields {
  teamName: string;
  projectName: string;
}

export interface CreateTeamWithProjectInput extends CreateTeamTextFields {
  userId: string;
  document: UploadedDocument;
}

export interface CreateTeamWithProjectOutput {
  team: Team;
  projectId: string;
  boardId: string;
  contextFileName: string;
}

export interface JoinTeamInput {
  inviteCode: string;
}

export interface JoinTeamCommand extends JoinTeamInput {
  userId: string;
}

export interface JoinTeamOutput {
  team: Team;
  boardId: string;
}

export type ListUserTeamsOutput = TeamSummary[];
