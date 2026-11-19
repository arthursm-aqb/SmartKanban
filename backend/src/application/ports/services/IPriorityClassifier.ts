import { PriorityScore } from '../../../domain/value-objects/PriorityScore';

export interface TaskToClassify {
  title: string;
  description: string;
}

export interface BoardContextSummary {
  projectName: string;
  contextDocumentText: string;
  storyTitle: string;
  storyDescription: string;
  existingBacklogCount: number;
  inSpecificationCount: number;
  specifiedTasksCount: number;
  inImplementationCount: number;
  inReviewCount: number;
  existingStoryTitles: string[];
}

export interface ClassifiedTaskResult {
  taskIndex: number;
  priority: PriorityScore;
  classifiedByModel: string;
}

export interface IPriorityClassifier {
  classify(context: BoardContextSummary, tasks: TaskToClassify[]): Promise<ClassifiedTaskResult[]>;
}
