import React, { useEffect, useState } from 'react';
import { Task } from '../types/kanban';
import { useAccessibleFormValidation } from '../utils/formAriaSync';
import { RetroDialog } from './RetroDialog';

interface TaskModalProps {
  task: Task | null;
  onClose: () => void;
  onSave: (taskId: string, data: { title: string; description: string }) => Promise<void>;
}

export function TaskModal({ task, onClose, onSave }: TaskModalProps) {
  const formRef = useAccessibleFormValidation<HTMLFormElement>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setError(null);
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSave(task.id, { title, description });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar tarefa.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RetroDialog
      open={Boolean(task)}
      title="Editar Tarefa"
      onClose={onClose}
      closeDisabled={submitting}
    >
      {task && (
        <form ref={formRef} onSubmit={(e) => void handleSubmit(e)}>
          {error && (
            <div role="alert" className="win-banner-error">
              {error}
            </div>
          )}

          <div className="win-field">
            <label htmlFor="edit-task-title" className="win-label">
              Título da Tarefa <span aria-hidden="true">*</span>
            </label>
            <input
              id="edit-task-title"
              type="text"
              className="win-input"
              required
              minLength={3}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="win-field">
            <label htmlFor="edit-task-desc" className="win-label">
              Descrição Técnica
            </label>
            <textarea
              id="edit-task-desc"
              className="win-textarea"
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="win-btn" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="win-btn win-btn-primary" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar Tarefa'}
            </button>
          </div>
        </form>
      )}
    </RetroDialog>
  );
}
