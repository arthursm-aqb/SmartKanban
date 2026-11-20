import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';

describe('App loading state', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exibe "Aguarde um momento" com pontos animados e progressbar acessível sem citar HttpOnly', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

    render(<App />);

    expect(screen.getByRole('progressbar', { name: 'Aguarde um momento' })).toBeInTheDocument();
    expect(screen.getByText(/Aguarde um momento/)).toBeInTheDocument();
    expect(screen.queryByText(/HttpOnly/i)).not.toBeInTheDocument();
  });
});
