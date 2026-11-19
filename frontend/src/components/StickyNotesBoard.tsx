import React, { useState } from 'react';
import { Move, Plus, Trash2 } from 'lucide-react';
import { useBoardRealtime } from '../contexts/BoardRealtimeContext';
import { StickyNote, StickyNoteColor } from '../types/kanban';

const COLORS: Array<{ value: StickyNoteColor; label: string }> = [
  { value: 'YELLOW', label: 'Amarelo' },
  { value: 'BLUE', label: 'Azul' },
  { value: 'PINK', label: 'Rosa' },
  { value: 'GREEN', label: 'Verde' },
];

export function StickyNotesBoard() {
  const { snapshot, createNote, updateNote, deleteNote } = useBoardRealtime();
  const [content, setContent] = useState('');
  const [color, setColor] = useState<StickyNoteColor>('YELLOW');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  if (!snapshot) return null;

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

  const handleNudge = (note: StickyNote, dx: number, dy: number) => {
    void updateNote(note.id, {
      posX: Math.max(0, Math.min(1400, note.posX + dx)),
      posY: Math.max(0, Math.min(900, note.posY + dy)),
    }).catch(() => {});
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <form
        onSubmit={(e) => void handleCreate(e)}
        className="win-window"
        style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}
      >
        <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label htmlFor="new-note-content" className="win-label">
            Nova observação / Post-it da equipe
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

      <div className="win-sunken notes-canvas" aria-label="Mural de post-its colaborativo">
        {snapshot.notes.length === 0 ? (
          <p className="win-hint">
            Nenhum post-it ainda. Cole uma observação acima — todos verão em tempo real via
            WebSocket.
          </p>
        ) : (
          snapshot.notes.map((note) => {
            const isEditing = editingId === note.id;
            return (
              <article
                key={note.id}
                className={`sticky-note sticky-${note.color}`}
                style={{ left: note.posX, top: note.posY }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                  <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                    {note.authorName ?? 'Membro'}
                  </span>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <button
                      type="button"
                      className="win-btn win-btn-icon"
                      aria-label="Mover post-it para esquerda"
                      onClick={() => handleNudge(note, -40, 0)}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="win-btn win-btn-icon"
                      aria-label="Mover post-it para direita"
                      onClick={() => handleNudge(note, 40, 0)}
                    >
                      →
                    </button>
                    <button
                      type="button"
                      className="win-btn win-btn-icon"
                      aria-label="Mover post-it para baixo"
                      onClick={() => handleNudge(note, 0, 35)}
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
