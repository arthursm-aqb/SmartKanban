import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StickyNotesBoard } from '../src/components/StickyNotesBoard';
import { StickyNote } from '../src/types/kanban';

if (typeof globalThis.PointerEvent === 'undefined') {
  class MockPointerEvent extends MouseEvent {
    public readonly pointerId: number;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
    }
  }
  globalThis.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
}

const mockUpdateNote = vi.fn().mockResolvedValue({});
const mockCreateNote = vi.fn().mockResolvedValue({});
const mockDeleteNote = vi.fn().mockResolvedValue(undefined);

let mockNotes: StickyNote[] = [];

vi.mock('../src/contexts/BoardRealtimeContext', () => ({
  useBoardRealtime: () => ({
    snapshot: {
      boardId: 'board-1',
      team: { id: 't1', name: 'Time', inviteCode: 'ABC12345', createdById: 'u1' },
      members: [],
      project: {
        id: 'p1',
        name: 'Projeto',
        contextFileName: 'doc.md',
        contextFileType: 'MD',
        contextText: '',
      },
      columns: [],
      wipOccupancy: {} as never,
      stories: [],
      tasks: [],
      notes: mockNotes,
      activityLogs: [],
      onlineUsers: [],
    },
    createNote: mockCreateNote,
    updateNote: mockUpdateNote,
    deleteNote: mockDeleteNote,
  }),
}));

describe('StickyNotesBoard', () => {
  it('exibe textos limpos sem "Post-it da equipe" nem menção a WebSocket no estado vazio', () => {
    mockNotes = [];
    render(<StickyNotesBoard />);

    expect(screen.getByLabelText('Nova observação')).toBeInTheDocument();
    expect(screen.queryByText(/Post-it da equipe/i)).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum post-it ainda. Cole uma observação acima.')).toBeInTheDocument();
    expect(screen.queryByText(/WebSocket/i)).not.toBeInTheDocument();
  });

  it('permite arrastar livremente o post-it com pointer events e salva posição final ao soltar', async () => {
    mockUpdateNote.mockClear();
    mockNotes = [
      {
        id: 'note-1',
        boardId: 'board-1',
        authorId: 'u1',
        authorName: 'Arthur',
        content: 'Revisar deploy',
        color: 'YELLOW',
        posX: 100,
        posY: 80,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    render(<StickyNotesBoard />);

    const handle = screen.getByRole('button', {
      name: /Mover post-it de Arthur\. Arraste ou use as setas do teclado\./i,
    });

    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 110, clientY: 90 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 250, clientY: 170 });

    const noteCard = screen.getByTestId('sticky-note-note-1');
    expect(noteCard).toHaveClass('dragging');
    expect(mockUpdateNote).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.pointerUp(handle, { pointerId: 1, clientX: 250, clientY: 170 });
      await Promise.resolve();
    });

    expect(mockUpdateNote).toHaveBeenCalledTimes(1);
    expect(mockUpdateNote).toHaveBeenCalledWith('note-1', { posX: 240, posY: 160 });
  });

  it('permite mover o post-it nas 4 direções pelas setas do teclado e pelo painel de botões', async () => {
    mockUpdateNote.mockClear();
    mockNotes = [
      {
        id: 'note-2',
        boardId: 'board-1',
        authorId: 'u1',
        authorName: 'Arthur',
        content: 'Testar celular',
        color: 'BLUE',
        posX: 100,
        posY: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    render(<StickyNotesBoard />);

    const handle = screen.getByRole('button', {
      name: /Mover post-it de Arthur/i,
    });

    await act(async () => {
      fireEvent.keyDown(handle, { key: 'ArrowUp' });
      await Promise.resolve();
    });
    expect(mockUpdateNote).toHaveBeenLastCalledWith('note-2', { posX: 100, posY: 76 });

    fireEvent.click(screen.getByRole('button', { name: 'Mover post-it sem arrastar' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mover post-it para cima' }));
      await Promise.resolve();
    });
    expect(mockUpdateNote).toHaveBeenLastCalledWith('note-2', { posX: 100, posY: 60 });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mover post-it para direita' }));
      await Promise.resolve();
    });
    expect(mockUpdateNote).toHaveBeenLastCalledWith('note-2', { posX: 140, posY: 100 });
  });
});
