import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KanbanBoardView } from '../src/components/KanbanBoard';
import { BoardSnapshot } from '../src/types/kanban';

const mockSnapshot: BoardSnapshot = {
  boardId: 'board-1',
  team: {
    id: 'team-1',
    name: 'Time CSA',
    inviteCode: 'AB12CD34',
    createdById: 'user-1',
  },
  members: [
    {
      id: 'm1',
      teamId: 'team-1',
      userId: 'user-1',
      role: 'OWNER',
      joinedAt: new Date().toISOString(),
      userName: 'Alice',
      userEmail: 'alice@ifrn.edu.br',
    },
  ],
  project: {
    id: 'proj-1',
    name: 'Kanban Inteligente',
    contextFileName: 'visao.md',
    contextFileType: 'MD',
    contextText: '# Visão Geral\nSistema Kanban com Gemini Decisions.',
  },
  columns: [
    { id: 'c1', boardId: 'board-1', type: 'BACKLOG', wipLimit: null, position: 0 },
    { id: 'c2', boardId: 'board-1', type: 'SPECIFICATION', wipLimit: 2, position: 1 },
    { id: 'c3', boardId: 'board-1', type: 'IMPLEMENTATION', wipLimit: 3, position: 2 },
    { id: 'c4', boardId: 'board-1', type: 'CODE_REVIEW', wipLimit: 1, position: 3 },
  ],
  wipOccupancy: {
    BACKLOG: { columnType: 'BACKLOG', currentCount: 1, wipLimit: null, isFull: false },
    SPECIFICATION: { columnType: 'SPECIFICATION', currentCount: 2, wipLimit: 2, isFull: true },
    IMPLEMENTATION: { columnType: 'IMPLEMENTATION', currentCount: 1, wipLimit: 3, isFull: false },
    CODE_REVIEW: { columnType: 'CODE_REVIEW', currentCount: 0, wipLimit: 1, isFull: false },
  },
  stories: [
    {
      id: 'h0',
      boardId: 'board-1',
      columnType: 'BACKLOG',
      subcolumn: 'BACKLOG',
      title: 'História no Backlog',
      description: 'Ainda aguardando.',
      position: 0,
      authorId: 'user-1',
      authorName: 'Alice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'h1',
      boardId: 'board-1',
      columnType: 'SPECIFICATION',
      subcolumn: 'IN_SPECIFICATION',
      title: 'Autenticação HttpOnly',
      description: 'Implementar cookies HttpOnly.',
      position: 0,
      authorId: 'user-1',
      authorName: 'Alice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'h2',
      boardId: 'board-1',
      columnType: 'SPECIFICATION',
      subcolumn: 'SPECIFIED',
      title: 'Quadro em Tempo Real',
      description: 'Sincronização via Socket.IO.',
      position: 0,
      authorId: 'user-1',
      authorName: 'Alice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  tasks: [
    {
      id: 't1',
      boardId: 'board-1',
      storyId: 'h2',
      columnType: 'SPECIFICATION',
      subcolumn: 'SPECIFIED',
      title: 'Configurar rooms do Socket.IO',
      description: 'Room por boardId',
      position: 0,
      priorityScore: 5,
      priorityConfidence: 0.92,
      priorityCriteria: {
        businessAlignment: 5,
        technicalDependency: 5,
        userImpact: 4,
        boardUrgency: 4,
      },
      classifiedByModel: 'gemini-decision-1',
      authorId: 'user-1',
      authorName: 'Alice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't2',
      boardId: 'board-1',
      storyId: 'h2',
      columnType: 'SPECIFICATION',
      subcolumn: 'SPECIFIED',
      title: 'Ajustar indicador de presença',
      description: '',
      position: 1,
      priorityScore: 2,
      priorityConfidence: 0.81,
      priorityCriteria: {
        businessAlignment: 2,
        technicalDependency: 1,
        userImpact: 3,
        boardUrgency: 2,
      },
      classifiedByModel: 'gemini-decision-1',
      authorId: 'user-1',
      authorName: 'Alice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 't3',
      boardId: 'board-1',
      storyId: 'h2',
      columnType: 'CODE_REVIEW',
      subcolumn: 'REVIEWED',
      title: 'Setup inicial do schema',
      description: '',
      position: 0,
      priorityScore: 4,
      priorityConfidence: 0.88,
      priorityCriteria: {
        businessAlignment: 4,
        technicalDependency: 5,
        userImpact: 3,
        boardUrgency: 3,
      },
      classifiedByModel: 'gemini-decision-1',
      authorId: 'user-1',
      authorName: 'Alice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  notes: [],
  activityLogs: [],
};

function makeActions() {
  return {
    updateWip: vi.fn().mockResolvedValue(undefined),
    createStory: vi.fn().mockResolvedValue(undefined),
    updateStory: vi.fn().mockResolvedValue(undefined),
    moveStory: vi.fn().mockResolvedValue(undefined),
    deleteStory: vi.fn().mockResolvedValue(undefined),
    generateTasks: vi.fn().mockResolvedValue(undefined),
    reprioritizeTasks: vi.fn().mockResolvedValue(undefined),
    updateTask: vi.fn().mockResolvedValue(undefined),
    moveTask: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
  };
}

describe('KanbanBoardView', () => {
  it('renderiza as 4 colunas, contadores WIP exatos e linha agrupada de tarefas em Especificado com prioridade 0-5', () => {
    const actions = makeActions();
    render(<KanbanBoardView snapshot={mockSnapshot} actions={actions} />);

    expect(screen.getByTestId('column-BACKLOG')).toBeInTheDocument();
    expect(screen.getByTestId('column-SPECIFICATION')).toBeInTheDocument();
    expect(screen.getByTestId('column-IMPLEMENTATION')).toBeInTheDocument();
    expect(screen.getByTestId('column-CODE_REVIEW')).toBeInTheDocument();

    // WIP counts match exact domain rules (CODE_REVIEW = 0/1 even with task in REVIEWED)
    expect(screen.getByLabelText('WIP Backlog: 1 de ∞')).toBeInTheDocument();
    expect(screen.getByLabelText('WIP Especificação: 2 de 2')).toBeInTheDocument();
    expect(screen.getByLabelText('WIP Implementação: 1 de 3')).toBeInTheDocument();
    expect(screen.getByLabelText('WIP Revisão de Código: 0 de 1')).toBeInTheDocument();

    // Row in Especificado groups t1 & t2 under h2 and displays priority 0-5 badges (highest first)
    const row = screen.getByTestId('specified-row-h2');
    expect(row).toHaveTextContent('Quadro em Tempo Real');
    expect(row).toHaveTextContent('Linha com 2 tarefa(s) • conta 1 no WIP');
    expect(row).toHaveTextContent('P5 • Crítica');
    expect(row).toHaveTextContent('P2 • Baixa');
    expect(row.textContent?.indexOf('P5 • Crítica')).toBeLessThan(
      row.textContent?.indexOf('P2 • Baixa') ?? -1,
    );
    // Reviewed task has no move-back button
    expect(
      screen.queryByRole('button', { name: /Mover Setup inicial do schema para Em revisão/i }),
    ).not.toBeInTheDocument();
  });

  it('abre pop-up ao clicar em história na subcoluna Em especificação e envia tarefas para geração', async () => {
    const actions = makeActions();
    render(<KanbanBoardView snapshot={mockSnapshot} actions={actions} />);

    // Click the story in "Em especificação"
    fireEvent.click(screen.getByText('Autenticação HttpOnly'));

    expect(screen.getByText('Especificar História e Gerar Tarefas')).toBeInTheDocument();

    // Fill Task 1, add Task 2, fill Task 2, submit
    fireEvent.change(screen.getByPlaceholderText('Título da tarefa T1'), {
      target: { value: 'Criar endpoint /api/auth/login' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Adicionar tarefa/i }));
    fireEvent.change(screen.getByPlaceholderText('Título da tarefa T2'), {
      target: { value: 'Emitir cookies HttpOnly' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Gerar tarefas' }));

    await waitFor(() => {
      expect(actions.generateTasks).toHaveBeenCalledWith('h1', [
        { title: 'Criar endpoint /api/auth/login', description: undefined },
        { title: 'Emitir cookies HttpOnly', description: undefined },
      ]);
    });
  });

  it('expande critérios da classificação Gemini Decisions ao clicar no botão de detalhes do badge', () => {
    const actions = makeActions();
    render(<KanbanBoardView snapshot={mockSnapshot} actions={actions} />);

    const expandButtons = screen.getAllByRole('button', { name: 'Ver critérios da classificação' });
    fireEvent.click(expandButtons[0]!);

    expect(screen.getByText('Alinhamento: 5/5')).toBeInTheDocument();
    expect(screen.getByText('Dependência: 5/5')).toBeInTheDocument();
    expect(screen.getByText('Impacto: 4/5')).toBeInTheDocument();
    expect(screen.getByText('Urgência: 4/5')).toBeInTheDocument();
  });
});
