import { StickyNoteColor } from '../../domain/entities/StickyNote';

export interface CreateStickyNoteInput {
  content: string;
  color: StickyNoteColor;
  posX: number;
  posY: number;
}

export interface CreateStickyNoteCommand extends CreateStickyNoteInput {
  boardId: string;
  actorId: string;
}

export interface UpdateStickyNoteInput {
  noteId: string;
  content?: string;
  color?: StickyNoteColor;
  posX?: number;
  posY?: number;
}

export interface UpdateStickyNoteCommand extends UpdateStickyNoteInput {
  boardId: string;
  actorId: string;
}

export interface DeleteStickyNoteInput {
  noteId: string;
}

export interface DeleteStickyNoteCommand extends DeleteStickyNoteInput {
  boardId: string;
  actorId: string;
}
