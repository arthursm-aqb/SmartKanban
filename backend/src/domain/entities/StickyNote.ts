export enum StickyNoteColor {
  YELLOW = 'YELLOW',
  BLUE = 'BLUE',
  PINK = 'PINK',
  GREEN = 'GREEN',
}

export interface StickyNote {
  id: string;
  boardId: string;
  content: string;
  color: StickyNoteColor;
  posX: number;
  posY: number;
  authorId: string;
  authorName?: string;
  createdAt: Date;
  updatedAt: Date;
}
