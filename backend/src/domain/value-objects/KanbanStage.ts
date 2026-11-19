export enum ColumnType {
  BACKLOG = 'BACKLOG',
  SPECIFICATION = 'SPECIFICATION',
  IMPLEMENTATION = 'IMPLEMENTATION',
  CODE_REVIEW = 'CODE_REVIEW',
}

export enum SubcolumnType {
  BACKLOG = 'BACKLOG',
  IN_SPECIFICATION = 'IN_SPECIFICATION',
  SPECIFIED = 'SPECIFIED',
  IN_IMPLEMENTATION = 'IN_IMPLEMENTATION',
  IMPLEMENTED = 'IMPLEMENTED',
  IN_REVIEW = 'IN_REVIEW',
  REVIEWED = 'REVIEWED',
}

export const SUBCOLUMN_TO_COLUMN: Record<SubcolumnType, ColumnType> = {
  [SubcolumnType.BACKLOG]: ColumnType.BACKLOG,
  [SubcolumnType.IN_SPECIFICATION]: ColumnType.SPECIFICATION,
  [SubcolumnType.SPECIFIED]: ColumnType.SPECIFICATION,
  [SubcolumnType.IN_IMPLEMENTATION]: ColumnType.IMPLEMENTATION,
  [SubcolumnType.IMPLEMENTED]: ColumnType.IMPLEMENTATION,
  [SubcolumnType.IN_REVIEW]: ColumnType.CODE_REVIEW,
  [SubcolumnType.REVIEWED]: ColumnType.CODE_REVIEW,
};

export const COLUMN_LABELS: Record<ColumnType, string> = {
  [ColumnType.BACKLOG]: 'Backlog',
  [ColumnType.SPECIFICATION]: 'Especificação',
  [ColumnType.IMPLEMENTATION]: 'Implementação',
  [ColumnType.CODE_REVIEW]: 'Revisão de Código',
};

export const SUBCOLUMN_LABELS: Record<SubcolumnType, string> = {
  [SubcolumnType.BACKLOG]: 'Backlog',
  [SubcolumnType.IN_SPECIFICATION]: 'Em especificação',
  [SubcolumnType.SPECIFIED]: 'Especificado',
  [SubcolumnType.IN_IMPLEMENTATION]: 'Em implementação',
  [SubcolumnType.IMPLEMENTED]: 'Implementado',
  [SubcolumnType.IN_REVIEW]: 'Em revisão',
  [SubcolumnType.REVIEWED]: 'Revisado',
};

export const INITIAL_COLUMN_ORDER: ReadonlyArray<{ type: ColumnType; position: number }> = [
  { type: ColumnType.BACKLOG, position: 0 },
  { type: ColumnType.SPECIFICATION, position: 1 },
  { type: ColumnType.IMPLEMENTATION, position: 2 },
  { type: ColumnType.CODE_REVIEW, position: 3 },
];

export const STORY_MOVABLE_SUBCOLUMNS: ReadonlySet<SubcolumnType> = new Set([
  SubcolumnType.BACKLOG,
  SubcolumnType.IN_SPECIFICATION,
]);

export const TASK_ALLOWED_SUBCOLUMNS: ReadonlySet<SubcolumnType> = new Set([
  SubcolumnType.SPECIFIED,
  SubcolumnType.IN_IMPLEMENTATION,
  SubcolumnType.IMPLEMENTED,
  SubcolumnType.IN_REVIEW,
  SubcolumnType.REVIEWED,
]);

export function getParentColumn(subcolumn: SubcolumnType): ColumnType {
  return SUBCOLUMN_TO_COLUMN[subcolumn];
}
