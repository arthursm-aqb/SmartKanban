import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PriorityCriteria } from '../types/kanban';

const PRIORITY_NAMES: Record<number, string> = {
  0: 'Mínima',
  1: 'Muito Baixa',
  2: 'Baixa',
  3: 'Média',
  4: 'Alta',
  5: 'Crítica',
};

// Needle rotation in degrees from 12 o'clock: sweeps symmetrically left (-120°) to right (+120°)
const PRIORITY_ANGLES: Record<number, number> = {
  0: -120,
  1: -72,
  2: -24,
  3: 24,
  4: 72,
  5: 120,
};

function PriorityGaugeIcon({ score }: { score: number }) {
  const angle = PRIORITY_ANGLES[score] ?? 0;

  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      {/* Dial arc (~250° sweep) */}
      <path
        d="M 5.04 18.38 A 8.5 8.5 0 1 1 18.96 18.38"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* Subtle scale ticks at min, mid, and max */}
      <line x1="6.4" y1="16.8" x2="7.7" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
      <line x1="12" y1="5" x2="12" y2="6.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
      <line x1="17.6" y1="16.8" x2="16.3" y2="16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
      {/* Dynamic pointer rotated according to priority 0..5 */}
      <line
        data-testid="priority-gauge-needle"
        data-score={score}
        data-angle={angle}
        x1="12"
        y1="13.5"
        x2="12"
        y2="6.2"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        transform={`rotate(${angle} 12 13.5)`}
      />
      {/* Center pivot */}
      <circle cx="12" cy="13.5" r="2.1" fill="currentColor" />
    </svg>
  );
}

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
          <PriorityGaugeIcon score={clamped} />
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
