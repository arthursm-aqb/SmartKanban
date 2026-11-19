import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useBoardRealtime } from '../contexts/BoardRealtimeContext';
import { ActivityLog } from '../types/kanban';

const ACTION_TYPES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todas as ações' },
  { value: 'STORY_CREATED', label: 'História criada' },
  { value: 'STORY_MOVED', label: 'História movida' },
  { value: 'STORY_UPDATED', label: 'História editada' },
  { value: 'STORY_DELETED', label: 'História removida' },
  { value: 'TASKS_GENERATED', label: 'Tarefas geradas (IA)' },
  { value: 'TASKS_REPRIORITIZED', label: 'Tarefas reclassificadas' },
  { value: 'TASK_MOVED', label: 'Tarefa movida' },
  { value: 'TASK_UPDATED', label: 'Tarefa editada' },
  { value: 'TASK_DELETED', label: 'Tarefa removida' },
  { value: 'WIP_UPDATED', label: 'Limite WIP alterado' },
  { value: 'NOTE_CREATED', label: 'Post-it criado' },
  { value: 'NOTE_UPDATED', label: 'Post-it editado' },
  { value: 'NOTE_DELETED', label: 'Post-it removido' },
  { value: 'MEMBER_JOINED', label: 'Novo membro' },
];

export function ActivityLogTab() {
  const { snapshot, fetchActivityLogs } = useBoardRealtime();
  const [actorId, setActorId] = useState('');
  const [actionType, setActionType] = useState('');
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[] | null>(null);
  const [loading, setLoading] = useState(false);

  const logsToDisplay = filteredLogs ?? snapshot?.activityLogs ?? [];

  const applyFilter = async (nextActor: string, nextAction: string) => {
    if (!nextActor && !nextAction) {
      setFilteredLogs(null);
      return;
    }
    setLoading(true);
    try {
      const logs = await fetchActivityLogs({
        actorId: nextActor || undefined,
        actionType: nextAction || undefined,
      });
      setFilteredLogs(logs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!actorId && !actionType) {
      setFilteredLogs(null);
    }
  }, [snapshot?.activityLogs, actorId, actionType]);

  if (!snapshot) return null;

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <search>
        <div
          className="win-window"
          style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}
        >
          <div style={{ minWidth: 200 }}>
            <label htmlFor="log-actor-filter" className="win-label">
              Filtrar por integrante
            </label>
            <select
              id="log-actor-filter"
              className="win-select"
              value={actorId}
              onChange={(e) => {
                const val = e.target.value;
                setActorId(val);
                void applyFilter(val, actionType);
              }}
            >
              <option value="">Todos os integrantes</option>
              {snapshot.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userName ?? m.userEmail ?? m.userId}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 220 }}>
            <label htmlFor="log-action-filter" className="win-label">
              Filtrar por tipo de ação
            </label>
            <select
              id="log-action-filter"
              className="win-select"
              value={actionType}
              onChange={(e) => {
                const val = e.target.value;
                setActionType(val);
                void applyFilter(actorId, val);
              }}
            >
              {ACTION_TYPES.map((t) => (
                <option key={t.value || 'ALL'} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="win-btn"
            disabled={loading}
            onClick={() => void applyFilter(actorId, actionType)}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </search>

      <div className="win-sunken" style={{ padding: 12, maxHeight: '62vh', overflowY: 'auto' }}>
        {logsToDisplay.length === 0 ? (
          <p className="win-hint">Nenhum registro encontrado para os filtros aplicados.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logsToDisplay.map((log) => (
              <li key={log.id} className="kanban-card" style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <strong>{log.actorName ?? 'Membro'}</strong> — {log.summary}
                  </div>
                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--win-muted)' }}>
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--win-muted)' }}>
                  [{log.actionType}]
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
