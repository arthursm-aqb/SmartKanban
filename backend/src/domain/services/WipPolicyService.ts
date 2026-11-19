import { BoardColumn } from '../entities/BoardColumn';
import { Task } from '../entities/Task';
import { UserStory } from '../entities/UserStory';
import { WipLimitExceededError } from '../errors';
import { ColumnType, SubcolumnType, getParentColumn } from '../value-objects/KanbanStage';

export interface ColumnWipOccupancy {
  columnType: ColumnType;
  currentCount: number;
  wipLimit: number | null;
  isFull: boolean;
}

export interface BoardWipState {
  columns: ReadonlyArray<BoardColumn>;
  stories: ReadonlyArray<Pick<UserStory, 'id' | 'subcolumn'>>;
  tasks: ReadonlyArray<Pick<Task, 'id' | 'storyId' | 'subcolumn'>>;
}

/**
 * Pure Domain Service enforcing the exact Kanban WIP rules:
 * 1. BACKLOG: 1 per UserStory in BACKLOG.
 * 2. SPECIFICATION: 1 per UserStory in IN_SPECIFICATION + 1 per distinct storyId
 *    that has >= 1 Task remaining in SPECIFIED.
 * 3. IMPLEMENTATION: 1 per Task in IN_IMPLEMENTATION or IMPLEMENTED.
 * 4. CODE_REVIEW: 1 per Task in IN_REVIEW only (REVIEWED is excluded from WIP).
 */
export class WipPolicyService {
  public calculateColumnCount(columnType: ColumnType, state: Pick<BoardWipState, 'stories' | 'tasks'>): number {
    switch (columnType) {
      case ColumnType.BACKLOG:
        return state.stories.filter((story) => story.subcolumn === SubcolumnType.BACKLOG).length;

      case ColumnType.SPECIFICATION: {
        const storiesInSpec = state.stories.filter(
          (story) => story.subcolumn === SubcolumnType.IN_SPECIFICATION,
        ).length;
        const activeSpecifiedRows = new Set(
          state.tasks
            .filter((task) => task.subcolumn === SubcolumnType.SPECIFIED)
            .map((task) => task.storyId),
        ).size;
        return storiesInSpec + activeSpecifiedRows;
      }

      case ColumnType.IMPLEMENTATION:
        return state.tasks.filter(
          (task) =>
            task.subcolumn === SubcolumnType.IN_IMPLEMENTATION ||
            task.subcolumn === SubcolumnType.IMPLEMENTED,
        ).length;

      case ColumnType.CODE_REVIEW:
        // REVIEWED intentionally does NOT count toward CODE_REVIEW WIP limit.
        return state.tasks.filter((task) => task.subcolumn === SubcolumnType.IN_REVIEW).length;
    }
  }

  public calculateAllOccupancies(state: BoardWipState): Record<ColumnType, ColumnWipOccupancy> {
    const result = {} as Record<ColumnType, ColumnWipOccupancy>;
    for (const column of state.columns) {
      const currentCount = this.calculateColumnCount(column.type, state);
      result[column.type] = {
        columnType: column.type,
        currentCount,
        wipLimit: column.wipLimit,
        isFull: column.wipLimit !== null && currentCount >= column.wipLimit,
      };
    }
    return result;
  }

  public assertCanCreateStoryInBacklog(state: BoardWipState): void {
    const backlogColumn = state.columns.find((col) => col.type === ColumnType.BACKLOG);
    if (!backlogColumn || backlogColumn.wipLimit === null) return;

    const currentCount = this.calculateColumnCount(ColumnType.BACKLOG, state);
    if (currentCount >= backlogColumn.wipLimit) {
      throw new WipLimitExceededError(ColumnType.BACKLOG, currentCount, backlogColumn.wipLimit);
    }
  }

  public assertCanMoveStory(
    story: Pick<UserStory, 'id' | 'subcolumn'>,
    targetSubcolumn: SubcolumnType,
    state: BoardWipState,
  ): void {
    const sourceColumn = getParentColumn(story.subcolumn);
    const targetColumn = getParentColumn(targetSubcolumn);

    // Moving within the same parent column does not increase WIP.
    if (sourceColumn === targetColumn) return;

    const column = state.columns.find((col) => col.type === targetColumn);
    if (!column || column.wipLimit === null) return;

    const currentCount = this.calculateColumnCount(targetColumn, state);
    if (currentCount >= column.wipLimit) {
      throw new WipLimitExceededError(targetColumn, currentCount, column.wipLimit);
    }
  }

  public assertCanMoveTask(
    task: Pick<Task, 'id' | 'storyId' | 'subcolumn'>,
    targetSubcolumn: SubcolumnType,
    state: BoardWipState,
  ): void {
    // REVIEWED is explicitly exempt from WIP enforcement.
    if (targetSubcolumn === SubcolumnType.REVIEWED) return;

    // Moving within the same subcolumn is a pure reorder (delta = 0).
    if (task.subcolumn === targetSubcolumn) return;

    const sourceColumn = getParentColumn(task.subcolumn);
    const targetColumn = getParentColumn(targetSubcolumn);

    // Moving between IN_IMPLEMENTATION and IMPLEMENTED stays within IMPLEMENTATION (delta = 0).
    if (sourceColumn === ColumnType.IMPLEMENTATION && targetColumn === ColumnType.IMPLEMENTATION) {
      return;
    }

    // Moving a task into SPECIFIED: if its story row already has >= 1 OTHER task in SPECIFIED,
    // the row already counts as 1 (delta = 0); otherwise it activates a new row (delta = +1).
    if (targetSubcolumn === SubcolumnType.SPECIFIED) {
      const hasExistingRow = state.tasks.some(
        (existing) =>
          existing.id !== task.id &&
          existing.storyId === task.storyId &&
          existing.subcolumn === SubcolumnType.SPECIFIED,
      );
      if (hasExistingRow) return;
    }

    // Notice: Moving REVIEWED -> IN_REVIEW enters WIP-counted IN_REVIEW (delta = +1), so we DO check.
    const column = state.columns.find((col) => col.type === targetColumn);
    if (!column || column.wipLimit === null) return;

    const currentCount = this.calculateColumnCount(targetColumn, state);
    if (currentCount >= column.wipLimit) {
      throw new WipLimitExceededError(targetColumn, currentCount, column.wipLimit);
    }
  }
}
