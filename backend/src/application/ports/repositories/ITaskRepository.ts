import { Task } from '../../../domain/entities/Task';
import { ColumnType, SubcolumnType } from '../../../domain/value-objects/KanbanStage';
import { PriorityCriteria } from '../../../domain/value-objects/PriorityScore';

export interface CreateTaskRepoData {
  boardId: string;
  storyId: string;
  title: string;
  description: string;
  position: number;
  priorityScore: number;
  priorityConfidence: number;
  priorityCriteria: PriorityCriteria;
  classifiedByModel: string;
  authorId: string;
}

export interface UpdateTaskRepoData {
  title?: string;
  description?: string;
}

export interface UpdateTaskPriorityRepoData {
  priorityScore: number;
  priorityConfidence: number;
  priorityCriteria: PriorityCriteria;
  classifiedByModel: string;
}

export interface MoveTaskRepoData {
  columnType: ColumnType;
  subcolumn: SubcolumnType;
  position: number;
}

export interface ITaskRepository {
  findById(taskId: string): Promise<Task | null>;
  listByBoardId(boardId: string): Promise<Task[]>;
  listByStoryId(storyId: string): Promise<Task[]>;
  createManyAndMarkStorySpecified(storyId: string, tasks: CreateTaskRepoData[]): Promise<Task[]>;
  update(taskId: string, data: UpdateTaskRepoData): Promise<Task>;
  updatePriority(taskId: string, data: UpdateTaskPriorityRepoData): Promise<Task>;
  move(taskId: string, data: MoveTaskRepoData): Promise<Task>;
  delete(taskId: string): Promise<void>;
}
