export enum TeamRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
}

export interface Team {
  id: string;
  name: string;
  inviteCode: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: Date;
  userName?: string;
  userEmail?: string;
}

export interface TeamSummary {
  team: Team;
  role: TeamRole;
  projectId: string;
  projectName: string;
  boardId: string;
  memberCount: number;
  contextFileName: string;
  contextFileType: ContextFileType;
}

export enum ContextFileType {
  PDF = 'PDF',
  MD = 'MD',
  TXT = 'TXT',
}
