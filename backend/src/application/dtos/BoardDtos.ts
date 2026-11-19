import { ActivityLog } from '../../domain/entities/ActivityLog';
import { BoardColumn } from '../../domain/entities/BoardColumn';
import { Project } from '../../domain/entities/Project';
import { StickyNote } from '../../domain/entities/StickyNote';
import { Task } from '../../domain/entities/Task';
import { Team, TeamMember } from '../../domain/entities/Team';
import { UserStory } from '../../domain/entities/UserStory';
import { ColumnWipOccupancy } from '../../domain/services/WipPolicyService';
import { ColumnType } from '../../domain/value-objects/KanbanStage';

export interface JoinBoardInput {
  boardId: string;
}

export interface UpdateColumnWipInput {
  columnType: ColumnType;
  wipLimit: number | null;
}

export interface UpdateColumnWipCommand extends UpdateColumnWipInput {
  boardId: string;
  actorId: string;
}

export interface BoardSnapshotOutput {
  boardId: string;
  team: Team;
  members: TeamMember[];
  project: Pick<Project, 'id' | 'name' | 'contextFileName' | 'contextFileType' | 'contextText'>;
  columns: BoardColumn[];
  wipOccupancy: Record<ColumnType, ColumnWipOccupancy>;
  stories: UserStory[];
  tasks: Task[];
  notes: StickyNote[];
  activityLogs: ActivityLog[];
}
