import { StickyNote, StickyNoteColor } from '../../../domain/entities/StickyNote';

export interface CreateStickyNoteRepoData {
  boardId: string;
  content: string;
  color: StickyNoteColor;
  posX: number;
  posY: number;
  authorId: string;
}

export interface UpdateStickyNoteRepoData {
  content?: string;
  color?: StickyNoteColor;
  posX?: number;
  posY?: number;
}

export interface IStickyNoteRepository {
  findById(noteId: string): Promise<StickyNote | null>;
  listByBoardId(boardId: string): Promise<StickyNote[]>;
  create(data: CreateStickyNoteRepoData): Promise<StickyNote>;
  update(noteId: string, data: UpdateStickyNoteRepoData): Promise<StickyNote>;
  delete(noteId: string): Promise<void>;
}
