import React, { useEffect, useState } from 'react';
import { COLUMN_LABELS, ColumnType } from '../types/kanban';
import { RetroDialog } from './RetroDialog';

interface WipConfigDialogProps {
  column: { type: ColumnType; currentLimit: number | null; currentCount: number } | null;
  onClose: () => void;
  onSave: (columnType: ColumnType, wipLimit: number | null) => Promise<void>;
}

export function WipConfigDialog({ column, onClose, onSave }: WipConfigDialogProps) {
  const [hasLimit, setHasLimit] = useState(false);
  const [limitValue, setLimitValue] = useState('3');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (column) {
      setHasLimit(column.currentLimit !== null);
      setLimitValue(String(column.currentLimit ?? Math.max(1, column.currentCount || 3)));
      setError(null);
    }
  }, [column]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!column) return;

    let parsed: number | null = null;
    if (hasLimit) {
      const n = Number(limitValue);
      if (!Number.isInteger(n) || n < 1 || n > 99) {
        setError('Informe um limite inteiro entre 1 e 99.');
        return;
      }
      parsed = n;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSave(column.type, parsed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar limite WIP.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RetroDialog
      open={Boolean(column)}
      title={column ? `Configurar WIP — ${COLUMN_LABELS[column.type]}` : 'Configurar WIP'}
      onClose={onClose}
      closeDisabled={submitting}
    >
      {column && (
        <form onSubmit={(e) => void handleSubmit(e)}>
          {error && (
            <div role="alert" className="win-banner-error">
              {error}
            </div>
          )}

          <p style={{ marginTop: 0, fontSize: '0.88rem', color: 'var(--win-muted)' }}>
            Ocupação atual: <strong className="mono">{column.currentCount}</strong> item(ns).
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <input
              id="wip-enabled-toggle"
              type="checkbox"
              checked={hasLimit}
              onChange={(e) => setHasLimit(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
            />
            <label htmlFor="wip-enabled-toggle" className="win-label" style={{ cursor: 'pointer' }}>
              Ativar limite rígido de WIP nesta coluna
            </label>
          </div>

          {hasLimit && (
            <div className="win-field">
              <label htmlFor="wip-limit-input" className="win-label">
                Limite máximo de itens (1 a 99)
              </label>
              <input
                id="wip-limit-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{1,2}"
                className="win-input mono"
                value={limitValue}
                onChange={(e) => setLimitValue(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="win-btn" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="win-btn win-btn-primary" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Aplicar WIP'}
            </button>
          </div>
        </form>
      )}
    </RetroDialog>
  );
}
