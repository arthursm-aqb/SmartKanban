import { ColumnType, SubcolumnType } from '../value-objects/KanbanStage';
import { PriorityCriteria } from '../value-objects/PriorityScore';

export interface Task {
  id: string;
  boardId: string;
  storyId: string;
  columnType: ColumnType;
  subcolumn: SubcolumnType;
  title: string;
  description: string;
  position: number;
  priorityScore: number;
  priorityConfidence: number;
  priorityCriteria: PriorityCriteria;
  classifiedByModel: string;
  authorId: string;
  authorName?: string;
  createdAt: Date;
  updatedAt: Date;
}
