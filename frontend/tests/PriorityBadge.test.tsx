import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PriorityBadge } from '../src/components/PriorityBadge';

const sampleCriteria = {
  businessAlignment: 4,
  technicalDependency: 3,
  userImpact: 5,
  boardUrgency: 4,
};

describe('PriorityBadge dynamic gauge needle', () => {
  it('rotaciona o ponteiro de forma progressiva de P0 a P5 com P5 em lado oposto a P1', () => {
    const scores = [0, 1, 2, 3, 4, 5];
    const angles: number[] = [];

    for (const score of scores) {
      const { unmount } = render(<PriorityBadge score={score} criteria={sampleCriteria} />);
      const needle = screen.getByTestId('priority-gauge-needle');
      const angle = Number(needle.getAttribute('data-angle'));
      angles.push(angle);

      expect(needle.closest('svg')).toHaveAttribute('aria-hidden', 'true');
      unmount();
    }

    // Strictly increasing left-to-right rotation across 0..5
    for (let i = 1; i < angles.length; i++) {
      expect(angles[i]).toBeGreaterThan(angles[i - 1]!);
    }

    // P1 points left (< 0 deg) while P5 points opposite side right (> 0 deg)
    expect(angles[1]).toBeLessThan(0);
    expect(angles[5]).toBeGreaterThan(0);
    expect(angles[0]).toBe(-120);
    expect(angles[5]).toBe(120);
  });
});
