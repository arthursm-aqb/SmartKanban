import React, { useEffect, useRef, useState } from 'react';
import { GripHorizontal, Move, Plus, Trash2 } from 'lucide-react';
import { useBoardRealtime } from '../contexts/BoardRealtimeContext';
import { StickyNote, StickyNoteColor } from '../types/kanban';

const COLORS: Array<{ value: StickyNoteColor; label: string }> = [
  { value: 'YELLOW', label: 'Amarelo' },
  { value: 'BLUE', label: 'Azul' },
  { value: 'PINK', label: 'Rosa' },
  { value: 'GREEN', label: 'Verde' },
];

const DRAG_THRESHOLD_PX = 4;
const KEYBOARD_STEP_PX = 24;
const KEYBOARD_FAST_STEP_PX = 64;
const NUDGE_STEP_PX = 40;
const DEFAULT_NOTE_WIDTH = 220;
const DEFAULT_NOTE_HEIGHT = 150;
const MAX_COORD = 10000;

interface DragSession {
  noteId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
  moved: boolean;
}

export function StickyNotesBoard() {
  const { snapshot, createNote, updateNote, deleteNote } = useBoardRealtime();
  const [content, setContent] = useState('');
  const [color, setColor] = useState<StickyNoteColor>('YELLOW');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [moveMenuId, setMoveMenuId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragSession | null>(null);
  const [pendingPositions, setPendingPositions] = useState<
    Record<string, { posX: number; posY: number }>
  >({});
  const [announcement, setAnnouncement] = useState('');

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const noteRefs = useRef<Record<string, HTMLElement | null>>({});
  const dragRef = useRef<DragSession | null>(null);
  const announceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (announceTimerRef.current !== null) {
        window.clearTimeout(announceTimerRef.current);
      }
    };
  }, []);

  if (!snapshot) return null;

  const announce = (msg: string) => {
    setAnnouncement(msg);
    if (announceTimerRef.current !== null) {
      window.clearTimeout(announceTimerRef.current);
    }
    announceTimerRef.current = window.setTimeout(() => {
      setAnnouncement('');
      announceTimerRef.current = null;
    }, 1000);
  };

  const clampPosition = (rawX: number, rawY: number, noteId: string) => {
    const canvas = canvasRef.current;
    const noteEl = noteRefs.current[noteId];
    const canvasW = canvas?.clientWidth || 1000;
    const canvasH = canvas?.clientHeight || 520;
    const noteW = noteEl?.offsetWidth || DEFAULT_NOTE_WIDTH;
    const noteH = noteEl?.offsetHeight || DEFAULT_NOTE_HEIGHT;

    const maxX = Math.min(MAX_COORD, Math.max(0, canvasW - noteW - 8));
    const maxY = Math.min(MAX_COORD, Math.max(0, canvasH - noteH - 8));

    return {
      posX: Math.round(Math.max(0, Math.min(maxX, rawX))),
      posY: Math.round(Math.max(0, Math.min(maxY, rawY))),
    };
  };

  const getNotePosition = (note: StickyNote) =>
    pendingPositions[note.id] ?? { posX: note.posX, posY: note.posY };

  const commitPosition = (noteId: string, nextPos: { posX: number; posY: number }, label: string) => {
    setPendingPositions((prev) => ({ ...prev, [noteId]: nextPos }));
    announce(label);
    void updateNote(noteId, nextPos)
      .catch(() => {})
      .finally(() => {
        setPendingPositions((prev) => {
          const latest = prev[noteId];
          if (!latest || (latest.posX === nextPos.posX && latest.posY === nextPos.posY)) {
            const { [noteId]: _removed, ...rest } = prev;
            return rest;
          }
          return prev;
        });
      });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const offset = snapshot.notes.length * 28;
      await createNote({
        content: content.trim(),
        color,
        posX: 24 + (offset % 420),
        posY: 24 + (Math.floor(offset / 420) * 180) % 300,
      });
      setContent('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNudge = (note: StickyNote, dx: number, dy: number, directionLabel: string) => {
    const current = getNotePosition(note);
    const nextPos = clampPosition(current.posX + dx, current.posY + dy, note.id);
    commitPosition(note.id, nextPos, `Post-it movido ${directionLabel}`);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, note: StickyNote) => {
    if (e.button !== 0) return;

    const current = getNotePosition(note);
    const canvas = canvasRef.current;
    const session: DragSession = {
      noteId: note.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startScrollLeft: canvas?.scrollLeft ?? 0,
      startScrollTop: canvas?.scrollTop ?? 0,
      originX: current.posX,
      originY: current.posY,
      dx: 0,
      dy: 0,
      moved: false,
    };

    dragRef.current = session;
    setDragState(session);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>, noteId: string) => {
    const session = dragRef.current;
    if (!session || session.noteId !== noteId || session.pointerId !== e.pointerId) return;

    const canvas = canvasRef.current;
    const scrollDx = (canvas?.scrollLeft ?? 0) - session.startScrollLeft;
    const scrollDy = (canvas?.scrollTop ?? 0) - session.startScrollTop;
    const rawDx = e.clientX - session.startClientX + scrollDx;
    const rawDy = e.clientY - session.startClientY + scrollDy;

    const moved =
      session.moved || Math.hypot(rawDx, rawDy) >= DRAG_THRESHOLD_PX;
    if (!moved) return;

    const clamped = clampPosition(session.originX + rawDx, session.originY + rawDy, noteId);
    const nextSession: DragSession = {
      ...session,
      dx: clamped.posX - session.originX,
      dy: clamped.posY - session.originY,
      moved: true,
    };
    dragRef.current = nextSession;
    setDragState(nextSession);
  };

  const finishPointerDrag = (e: React.PointerEvent<HTMLButtonElement>, noteId: string) => {
    const session = dragRef.current;
    if (!session || session.noteId !== noteId || session.pointerId !== e.pointerId) return;

    dragRef.current = null;
    setDragState(null);

    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }

    if (!session.moved) return;

    const nextPos = clampPosition(
      session.originX + session.dx,
      session.originY + session.dy,
      noteId,
    );
    if (nextPos.posX === session.originX && nextPos.posY === session.originY) return;

    commitPosition(noteId, nextPos, 'Post-it reposicionado no quadro');
  };

  const handleHandleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, note: StickyNote) => {
    const step = e.shiftKey ? KEYBOARD_FAST_STEP_PX : KEYBOARD_STEP_PX;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        handleNudge(note, -step, 0, 'para a esquerda');
        break;
      case 'ArrowRight':
        e.preventDefault();
        handleNudge(note, step, 0, 'para a direita');
        break;
      case 'ArrowUp':
        e.preventDefault();
        handleNudge(note, 0, -step, 'para cima');
        break;
      case 'ArrowDown':
        e.preventDefault();
        handleNudge(note, 0, step, 'para baixo');
        break;
    }
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="visually-hidden" aria-live="polite">
        {announcement}
      </div>

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="win-window"
        style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}
      >
        <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="new-note-content" className="win-label">
            Nova observação
          </label>
          <input
            id="new-note-content"
            type="text"
            className="win-input"
            maxLength={500}
            required
            placeholder="Deixe um lembrete, decisão ou alerta para os integrantes..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="new-note-color" className="win-label">
            Cor
          </label>
          <select
            id="new-note-color"
            className="win-select"
            value={color}
            onChange={(e) => setColor(e.target.value as StickyNoteColor)}
          >
            {COLORS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="win-btn win-btn-primary" disabled={submitting}>
          <Plus size={14} aria-hidden="true" />
          {submitting ? 'Adicionando...' : 'Colar Post-it'}
        </button>
      </form>

      <div
        ref={canvasRef}
        className="win-sunken notes-canvas"
        aria-label="Mural de post-its colaborativo"
      >
        {snapshot.notes.length === 0 ? (
          <p className="win-hint">Nenhum post-it ainda. Cole uma observação acima.</p>
        ) : (
          snapshot.notes.map((note) => {
            const isEditing = editingId === note.id;
            const isDragging = dragState?.noteId === note.id && dragState.moved;
            const isMoveMenuOpen = moveMenuId === note.id;
            const basePos = getNotePosition(note);

            return (
              <article
                key={note.id}
                ref={(el) => {
                  noteRefs.current[note.id] = el;
                }}
                data-testid={`sticky-note-${note.id}`}
                className={`sticky-note sticky-${note.color}${isDragging ? ' dragging' : ''}`}
                style={{
                  left: basePos.posX,
                  top: basePos.posY,
                  transform: isDragging
                    ? `translate3d(${dragState.dx}px, ${dragState.dy}px, 0)`
                    : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    className={`sticky-drag-handle${isDragging ? ' dragging' : ''}`}
                    aria-label={`Mover post-it de ${note.authorName ?? 'Membro'}. Arraste ou use as setas do teclado.`}
                    onPointerDown={(e) => handlePointerDown(e, note)}
                    onPointerMove={(e) => handlePointerMove(e, note.id)}
                    onPointerUp={(e) => finishPointerDrag(e, note.id)}
                    onPointerCancel={(e) => finishPointerDrag(e, note.id)}
                    onLostPointerCapture={(e) => finishPointerDrag(e, note.id)}
                    onKeyDown={(e) => handleHandleKeyDown(e, note)}
                  >
                    <GripHorizontal size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
                    <span className="sticky-drag-handle-author">
                      {note.authorName ?? 'Membro'}
                    </span>
                  </button>

                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="win-btn win-btn-icon"
                      aria-label="Mover post-it sem arrastar"
                      aria-expanded={isMoveMenuOpen}
                      title="Mover com botões ou ver atalhos de teclado"
                      onClick={() => setMoveMenuId(isMoveMenuOpen ? null : note.id)}
                    >
                      <Move size={11} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="win-btn win-btn-icon win-btn-danger"
                      aria-label="Remover post-it"
                      onClick={() => void deleteNote(note.id).catch(() => {})}
                    >
                      <Trash2 size={11} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {isMoveMenuOpen && (
                  <div className="sticky-nudge-panel" role="group" aria-label="Controles de posição">
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="win-btn win-btn-icon"
                        aria-label="Mover post-it para esquerda"
                        onClick={() => handleNudge(note, -NUDGE_STEP_PX, 0, 'para a esquerda')}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className="win-btn win-btn-icon"
                        aria-label="Mover post-it para cima"
                        onClick={() => handleNudge(note, 0, -NUDGE_STEP_PX, 'para cima')}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="win-btn win-btn-icon"
                        aria-label="Mover post-it para baixo"
                        onClick={() => handleNudge(note, 0, NUDGE_STEP_PX, 'para baixo')}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="win-btn win-btn-icon"
                        aria-label="Mover post-it para direita"
                        onClick={() => handleNudge(note, NUDGE_STEP_PX, 0, 'para a direita')}
                      >
                        →
                      </button>
                    </div>
                    <span className="mono" style={{ textAlign: 'center', fontSize: '0.68rem' }}>
                      Arraste pelo topo ou use ← ↑ ↓ →
                    </span>
                  </div>
                )}

                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <textarea
                      className="win-textarea"
                      style={{ minHeight: 68, fontSize: '0.84rem' }}
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      maxLength={500}
                    />
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="win-btn"
                        style={{ minHeight: 24, padding: '2px 6px', fontSize: '0.75rem' }}
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="win-btn win-btn-primary"
                        style={{ minHeight: 24, padding: '2px 8px', fontSize: '0.75rem' }}
                        onClick={() => {
                          void updateNote(note.id, { content: editingContent.trim() })
                            .then(() => setEditingId(null))
                            .catch(() => {});
                        }}
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    style={{ margin: 0, fontSize: '0.88rem', whiteSpace: 'pre-wrap', cursor: 'pointer' }}
                    onClick={() => {
                      setEditingId(note.id);
                      setEditingContent(note.content);
                    }}
                    title="Clique para editar o texto"
                  >
                    {note.content}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className="win-btn win-btn-icon"
                      aria-label={`Mudar cor do post-it para ${c.label}`}
                      style={{
                        minWidth: 20,
                        minHeight: 20,
                        padding: 0,
                        background: `var(--note-${c.value.toLowerCase()})`,
                        outline: note.color === c.value ? '2px solid #000' : 'none',
                      }}
                      onClick={() => void updateNote(note.id, { color: c.value }).catch(() => {})}
                    />
                  ))}
                  <button
                    type="button"
                    className="win-btn"
                    style={{ marginLeft: 'auto', minHeight: 22, padding: '1px 6px', fontSize: '0.72rem' }}
                    onClick={() => {
                      setEditingId(note.id);
                      setEditingContent(note.content);
                    }}
                  >
                    Editar
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
