import { ColumnType, COLUMN_LABELS } from '../value-objects/KanbanStage';
import { DomainError } from './DomainError';

export class WipLimitExceededError extends DomainError {
  public readonly columnType: ColumnType;
  public readonly currentCount: number;
  public readonly limit: number;

  constructor(columnType: ColumnType, currentCount: number, limit: number) {
    super(
      'WIP_LIMIT_EXCEEDED',
      `Limite WIP atingido na coluna "${COLUMN_LABELS[columnType]}" (${currentCount}/${limit}).`,
      { columnType, currentCount, limit },
    );
    this.columnType = columnType;
    this.currentCount = currentCount;
    this.limit = limit;
  }
}
