import { useState } from 'react';
import { ChevronDown, ChevronUp, Gauge } from 'lucide-react';
import { PriorityCriteria } from '../types/kanban';

const PRIORITY_NAMES: Record<number, string> = {
  0: 'Mínima',
  1: 'Muito Baixa',
  2: 'Baixa',
  3: 'Média',
  4: 'Alta',
  5: 'Crítica',
};

export function PriorityBadge({
  score,
  criteria,
}: {
  score: number;
  confidence?: number;
  criteria: PriorityCriteria;
  model?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const clamped = Math.max(0, Math.min(5, Math.round(score)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span className={`prio-badge prio-${clamped}`}>
          <Gauge size={12} aria-hidden="true" />
          P{clamped} • {PRIORITY_NAMES[clamped]}
        </span>
        <button
          type="button"
          className="win-btn win-btn-icon"
          aria-expanded={expanded}
          aria-label="Ver critérios da classificação"
          onClick={() => setExpanded((prev) => !prev)}
          style={{ minHeight: 22, minWidth: 22 }}
        >
          {expanded ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
        </button>
      </div>

      {expanded && (
        <div
          className="win-sunken mono"
          style={{
            padding: '6px 8px',
            fontSize: '0.72rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2px 8px',
          }}
        >
          <span>Alinhamento: {criteria.businessAlignment}/5</span>
          <span>Dependência: {criteria.technicalDependency}/5</span>
          <span>Impacto: {criteria.userImpact}/5</span>
          <span>Urgência: {criteria.boardUrgency}/5</span>
        </div>
      )}
    </div>
  );
}
