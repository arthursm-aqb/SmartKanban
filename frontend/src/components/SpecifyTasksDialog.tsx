import React, { useEffect, useState } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { UserStory } from '../types/kanban';
import { RetroDialog } from './RetroDialog';

interface DraftTaskItem {
  localId: string;
  title: string;
  description: string;
}

interface SpecifyTasksDialogProps {
  story: UserStory | null;
  onClose: () => void;
  onGenerate: (
    storyId: string,
    tasks: Array<{ title: string; description?: string }>,
  ) => Promise<void>;
}

export function SpecifyTasksDialog({ story, onClose, onGenerate }: SpecifyTasksDialogProps) {
  const [drafts, setDrafts] = useState<DraftTaskItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (story) {
      setDrafts([{ localId: crypto.randomUUID(), title: '', description: '' }]);
      setError(null);
    }
  }, [story]);

  const addTaskRow = () => {
    setDrafts((prev) => [...prev, { localId: crypto.randomUUID(), title: '', description: '' }]);
  };

  const removeTaskRow = (localId: string) => {
    setDrafts((prev) => (prev.length > 1 ? prev.filter((item) => item.localId !== localId) : prev));
  };

  const updateDraft = (localId: string, field: 'title' | 'description', value: string) => {
    setDrafts((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, [field]: value } : item)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!story) return;

    const cleanTasks = drafts.map((d) => ({
      title: d.title.trim(),
      description: d.description.trim() || undefined,
    }));

    if (cleanTasks.some((t) => t.title.length < 3)) {
      setError('Cada tarefa precisa ter um título com pelo menos 3 caracteres.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onGenerate(story.id, cleanTasks);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar e classificar tarefas.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RetroDialog
      open={Boolean(story)}
      title="Especificar História e Gerar Tarefas"
      onClose={onClose}
      closeDisabled={submitting}
    >
      {story && (
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="win-sunken" style={{ padding: 10, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{story.title}</div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--win-muted)' }}>
              {story.description || 'Sem descrição detalhada.'}
            </p>
            <div className="mono" style={{ fontSize: '0.76rem', marginTop: 6 }}>
              Autor: {story.authorName ?? 'Equipe'}
            </div>
          </div>

          {error && (
            <div role="alert" className="win-banner-error">
              {error}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <strong>Tarefas derivadas desta história ({drafts.length}/20)</strong>
            <button
              type="button"
              className="win-btn"
              onClick={addTaskRow}
              disabled={submitting || drafts.length >= 20}
            >
              <Plus size={14} aria-hidden="true" />
              Adicionar tarefa
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {drafts.map((draft, index) => (
              <div
                key={draft.localId}
                className="win-sunken"
                style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor={`draft-title-${draft.localId}`} className="win-label mono">
                    Tarefa T{index + 1} *
                  </label>
                  {drafts.length > 1 && (
                    <button
                      type="button"
                      className="win-btn win-btn-icon win-btn-danger"
                      aria-label={`Remover Tarefa T${index + 1}`}
                      onClick={() => removeTaskRow(draft.localId)}
                      disabled={submitting}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <input
                  id={`draft-title-${draft.localId}`}
                  type="text"
                  className="win-input"
                  required
                  minLength={3}
                  maxLength={120}
                  placeholder={`Título da tarefa T${index + 1}`}
                  value={draft.title}
                  onChange={(e) => updateDraft(draft.localId, 'title', e.target.value)}
                  autoFocus={index === 0}
                />

                <label htmlFor={`draft-desc-${draft.localId}`} className="win-label" style={{ fontSize: '0.8rem' }}>
                  Detalhes técnicos (opcional)
                </label>
                <input
                  id={`draft-desc-${draft.localId}`}
                  type="text"
                  className="win-input"
                  maxLength={2000}
                  placeholder="Contexto técnico para ajudar o Gemini Decisions..."
                  value={draft.description}
                  onChange={(e) => updateDraft(draft.localId, 'description', e.target.value)}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="win-btn" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="win-btn win-btn-primary" disabled={submitting}>
              <Sparkles size={15} aria-hidden="true" />
              {submitting ? 'Classificando no Gemini Decisions...' : 'Gerar tarefas'}
            </button>
          </div>
        </form>
      )}
    </RetroDialog>
  );
}
