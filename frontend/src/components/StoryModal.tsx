import React, { useEffect, useState } from 'react';
import { useAccessibleFormValidation } from '../utils/formAriaSync';
import { RetroDialog } from './RetroDialog';

interface StoryModalProps {
  open: boolean;
  initialData?: { id: string; title: string; description: string } | null;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string }) => Promise<void>;
}

export function StoryModal({ open, initialData, onClose, onSubmit }: StoryModalProps) {
  const formRef = useAccessibleFormValidation<HTMLFormElement>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(initialData?.title ?? '');
      setDescription(initialData?.description ?? '');
      setError(null);
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ title, description });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar história.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RetroDialog
      open={open}
      title={initialData ? 'Editar História de Usuário' : 'Nova História de Usuário (Backlog)'}
      onClose={onClose}
      closeDisabled={submitting}
    >
      <form ref={formRef} onSubmit={(e) => void handleSubmit(e)}>
        {error && (
          <div role="alert" className="win-banner-error">
            {error}
          </div>
        )}

        <div className="win-field">
          <label htmlFor="story-title" className="win-label">
            Título da História <span aria-hidden="true">*</span>
          </label>
          <span id="story-title-hint" className="win-hint">
            De 3 a 120 caracteres.
          </span>
          <input
            id="story-title"
            name="title"
            type="text"
            className="win-input"
            required
            minLength={3}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-describedby="story-title-hint"
            data-error="story-title-error"
            autoFocus
          />
          <span id="story-title-error" className="win-error-msg">
            Erro: Informe um título entre 3 e 120 caracteres.
          </span>
        </div>

        <div className="win-field">
          <label htmlFor="story-desc" className="win-label">
            Descrição / Critérios de Aceitação
          </label>
          <textarea
            id="story-desc"
            name="description"
            className="win-textarea"
            maxLength={4000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="win-btn" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="win-btn win-btn-primary" disabled={submitting}>
            {submitting ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Criar no Backlog'}
          </button>
        </div>
      </form>
    </RetroDialog>
  );
}
