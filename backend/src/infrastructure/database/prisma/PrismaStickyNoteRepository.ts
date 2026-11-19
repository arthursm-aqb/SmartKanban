import { PrismaClient } from '@prisma/client';
import {
  CreateStickyNoteRepoData,
  IStickyNoteRepository,
  UpdateStickyNoteRepoData,
} from '../../../application/ports/repositories/IStickyNoteRepository';
import { StickyNote, StickyNoteColor } from '../../../domain/entities/StickyNote';

function mapNote(row: {
  id: string;
  boardId: string;
  content: string;
  color: string;
  posX: number;
  posY: number;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  author?: { name: string };
}): StickyNote {
  return {
    id: row.id,
    boardId: row.boardId,
    content: row.content,
    color: row.color as StickyNoteColor,
    posX: row.posX,
    posY: row.posY,
    authorId: row.authorId,
    authorName: row.author?.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaStickyNoteRepository implements IStickyNoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findById(noteId: string): Promise<StickyNote | null> {
    const row = await this.prisma.stickyNote.findUnique({
      where: { id: noteId },
      include: { author: { select: { name: true } } },
    });
    return row ? mapNote(row) : null;
  }

  public async listByBoardId(boardId: string): Promise<StickyNote[]> {
    const rows = await this.prisma.stickyNote.findMany({
      where: { boardId },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapNote);
  }

  public async create(data: CreateStickyNoteRepoData): Promise<StickyNote> {
    const row = await this.prisma.stickyNote.create({
      data: {
        boardId: data.boardId,
        content: data.content,
        color: data.color,
        posX: data.posX,
        posY: data.posY,
        authorId: data.authorId,
      },
      include: { author: { select: { name: true } } },
    });
    return mapNote(row);
  }

  public async update(noteId: string, data: UpdateStickyNoteRepoData): Promise<StickyNote> {
    const row = await this.prisma.stickyNote.update({
      where: { id: noteId },
      data: {
        ...(data.content !== undefined ? { content: data.content } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.posX !== undefined ? { posX: data.posX } : {}),
        ...(data.posY !== undefined ? { posY: data.posY } : {}),
      },
      include: { author: { select: { name: true } } },
    });
    return mapNote(row);
  }

  public async delete(noteId: string): Promise<void> {
    await this.prisma.stickyNote.delete({ where: { id: noteId } });
  }
}
