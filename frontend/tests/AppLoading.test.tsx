import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { AuthProvider } from '../src/contexts/AuthContext';
import { WorkspacePage } from '../src/pages/WorkspacePage';

vi.mock('../src/services/socketClient', () => ({
  createBoardSocket: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  emitSocketCommand: vi.fn(),
}));

describe('Loading screens', () => {
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

  it('exibe "Carregando quadro Kanban da sua equipe, aguarde" com pontos animados ao abrir quadro', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'u1', name: 'Arthur', email: 'a@ifrn.edu.br' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(
      <MemoryRouter initialEntries={['/board/board-1']}>
        <AuthProvider>
          <Routes>
            <Route path="/board/:boardId" element={<WorkspacePage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('progressbar', {
        name: 'Carregando quadro Kanban da sua equipe, aguarde',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Carregando quadro Kanban da sua equipe, aguarde/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Carregando quadro Kanban em tempo real via WebSocket/i),
    ).not.toBeInTheDocument();
  });
});
