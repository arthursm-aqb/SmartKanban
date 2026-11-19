import { describe, expect, it } from 'vitest';
import { ActivityActionType } from '../../../src/domain/entities/ActivityLog';
import { StickyNoteColor } from '../../../src/domain/entities/StickyNote';
import {
  ConflictError,
  DomainValidationError,
  ForbiddenError,
  WipLimitExceededError,
} from '../../../src/domain/errors';
import { ColumnType, SubcolumnType } from '../../../src/domain/value-objects/KanbanStage';
import { createTestContainer } from '../../doubles/InMemoryContainer';

describe('Kanban & Team Use Cases (Clean Architecture + SOLID)', () => {
  it('cria equipe com arquivo .md, inicializa quadro vazio com 4 colunas e aplica todo o fluxo WIP + Gemini Decisions', async () => {
    const { container } = createTestContainer();

    const alice = await container.useCases.registerUser.execute({
      name: 'Alice',
      email: 'alice@dev.io',
      password: 'Password123!',
    });
    const bob = await container.useCases.registerUser.execute({
      name: 'Bob',
      email: 'bob@dev.io',
      password: 'Password123!',
    });
    const outsider = await container.useCases.registerUser.execute({
      name: 'Eve',
      email: 'eve@dev.io',
      password: 'Password123!',
    });

    const created = await container.useCases.createTeamWithProject.execute({
      userId: alice.user.id,
      teamName: 'Time CSA',
      projectName: 'Kanban Inteligente',
      document: {
        originalName: 'visao_geral.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from(
          '# Visão Geral\nSistema Kanban com autenticação JWT, PostgreSQL, WebSocket e Gemini Decisions.',
          'utf8',
        ),
      },
    });

    await container.useCases.joinTeamByInvite.execute({
      userId: bob.user.id,
      inviteCode: created.team.inviteCode,
    });

    // Outsider cannot read board (anti-IDOR)
    await expect(
      container.useCases.getBoardSnapshot.execute(created.boardId, outsider.user.id),
    ).rejects.toThrow(ForbiddenError);

    // Initial board must be empty with 4 columns
    const initialSnapshot = await container.useCases.getBoardSnapshot.execute(
      created.boardId,
      alice.user.id,
    );
    expect(initialSnapshot.columns).toHaveLength(4);
    expect(initialSnapshot.stories).toHaveLength(0);
    expect(initialSnapshot.tasks).toHaveLength(0);

    // Set WIP: SPECIFICATION = 1, IMPLEMENTATION = 2, CODE_REVIEW = 1
    await container.useCases.updateColumnWip.execute({
      boardId: created.boardId,
      actorId: alice.user.id,
      columnType: ColumnType.SPECIFICATION,
      wipLimit: 1,
    });
    await container.useCases.updateColumnWip.execute({
      boardId: created.boardId,
      actorId: alice.user.id,
      columnType: ColumnType.IMPLEMENTATION,
      wipLimit: 2,
    });
    await container.useCases.updateColumnWip.execute({
      boardId: created.boardId,
      actorId: alice.user.id,
      columnType: ColumnType.CODE_REVIEW,
      wipLimit: 1,
    });

    // Create 2 user stories in Backlog
    const { story: h1 } = await container.useCases.createStory.execute({
      boardId: created.boardId,
      actorId: alice.user.id,
      title: 'Autenticação HttpOnly',
      description: 'Login e cadastro seguros.',
    });
    const { story: h2 } = await container.useCases.createStory.execute({
      boardId: created.boardId,
      actorId: bob.user.id,
      title: 'Quadro de Anotações',
      description: 'Post-its em tempo real.',
    });

    // Cannot generate tasks while h1 is still in BACKLOG
    await expect(
      container.useCases.generateAndPrioritizeTasks.execute({
        boardId: created.boardId,
        actorId: alice.user.id,
        storyId: h1.id,
        tasks: [{ title: 'Criar migration de sessão' }],
      }),
    ).rejects.toThrow(DomainValidationError);

    // Move h1 -> IN_SPECIFICATION (SPECIFICATION WIP = 1/1)
    await container.useCases.moveStory.execute({
      boardId: created.boardId,
      actorId: alice.user.id,
      storyId: h1.id,
      toSubcolumn: SubcolumnType.IN_SPECIFICATION,
      position: 0,
    });

    // Moving h2 -> IN_SPECIFICATION must fail (SPECIFICATION 1/1)
    await expect(
      container.useCases.moveStory.execute({
        boardId: created.boardId,
        actorId: bob.user.id,
        storyId: h2.id,
        toSubcolumn: SubcolumnType.IN_SPECIFICATION,
        position: 0,
      }),
    ).rejects.toThrow(WipLimitExceededError);

    // Generate 3 tasks from h1 in IN_SPECIFICATION -> transitions h1 to SPECIFIED as 1 task row!
    const generated = await container.useCases.generateAndPrioritizeTasks.execute({
      boardId: created.boardId,
      actorId: alice.user.id,
      storyId: h1.id,
      tasks: [
        { title: 'Criar tabela RefreshSession no PostgreSQL', description: 'Schema e migration' },
        { title: 'Implementar cookie HttpOnly no Express', description: 'Auth e CSRF' },
        { title: 'Ajustar texto do botão de login', description: 'Texto simples' },
      ],
    });

    expect(generated.story.subcolumn).toBe(SubcolumnType.SPECIFIED);
    expect(generated.tasks).toHaveLength(3);
    expect(generated.wipOccupancy[ColumnType.SPECIFICATION].currentCount).toBe(1);
    for (const task of generated.tasks) {
      expect(task.priorityScore).toBeGreaterThanOrEqual(0);
      expect(task.priorityScore).toBeLessThanOrEqual(5);
    }

    const [t1, t2, t3] = generated.tasks;

    // Move t1 and t2 to IN_IMPLEMENTATION -> SPECIFICATION STILL 1 (t3 remains!)
    await container.useCases.moveTask.execute({
      boardId: created.boardId,
      actorId: bob.user.id,
      taskId: t1!.id,
      toSubcolumn: SubcolumnType.IN_IMPLEMENTATION,
      position: 0,
    });
    const afterT2 = await container.useCases.moveTask.execute({
      boardId: created.boardId,
      actorId: bob.user.id,
      taskId: t2!.id,
      toSubcolumn: SubcolumnType.IN_IMPLEMENTATION,
      position: 1,
    });
    expect(afterT2.wipOccupancy[ColumnType.SPECIFICATION].currentCount).toBe(1);
    expect(afterT2.wipOccupancy[ColumnType.IMPLEMENTATION].currentCount).toBe(2);

    // Moving t3 -> IN_IMPLEMENTATION blocked (IMPLEMENTATION 2/2)
    await expect(
      container.useCases.moveTask.execute({
        boardId: created.boardId,
        actorId: bob.user.id,
        taskId: t3!.id,
        toSubcolumn: SubcolumnType.IN_IMPLEMENTATION,
        position: 2,
      }),
    ).rejects.toThrow(WipLimitExceededError);

    // Move t1 -> IN_REVIEW (CODE_REVIEW 1/1) -> REVIEWED (CODE_REVIEW 0/1!)
    await container.useCases.moveTask.execute({
      boardId: created.boardId,
      actorId: alice.user.id,
      taskId: t1!.id,
      toSubcolumn: SubcolumnType.IN_REVIEW,
      position: 0,
    });
    const afterT1Reviewed = await container.useCases.moveTask.execute({
      boardId: created.boardId,
      actorId: alice.user.id,
      taskId: t1!.id,
      toSubcolumn: SubcolumnType.REVIEWED,
      position: 0,
    });
    expect(afterT1Reviewed.wipOccupancy[ColumnType.CODE_REVIEW].currentCount).toBe(0);

    // Reviewed tasks cannot return to IN_REVIEW or earlier stages
    await expect(
      container.useCases.moveTask.execute({
        boardId: created.boardId,
        actorId: alice.user.id,
        taskId: t1!.id,
        toSubcolumn: SubcolumnType.IN_REVIEW,
        position: 0,
      }),
    ).rejects.toThrow(DomainValidationError);

    // Move t3 (last task in h1's row) to IN_IMPLEMENTATION -> SPECIFICATION drops to 0!
    const afterLastTaskLeft = await container.useCases.moveTask.execute({
      boardId: created.boardId,
      actorId: bob.user.id,
      taskId: t3!.id,
      toSubcolumn: SubcolumnType.IN_IMPLEMENTATION,
      position: 1,
    });
    expect(afterLastTaskLeft.wipOccupancy[ColumnType.SPECIFICATION].currentCount).toBe(0);

    // Now h2 CAN enter Em especificação!
    const movedH2 = await container.useCases.moveStory.execute({
      boardId: created.boardId,
      actorId: bob.user.id,
      storyId: h2.id,
      toSubcolumn: SubcolumnType.IN_SPECIFICATION,
      position: 0,
    });
    expect(movedH2.wipOccupancy[ColumnType.SPECIFICATION].currentCount).toBe(1);

    // Sticky note CRUD
    const { note } = await container.useCases.createStickyNote.execute({
      boardId: created.boardId,
      actorId: bob.user.id,
      content: 'Revisar índices do PostgreSQL antes da entrega.',
      color: StickyNoteColor.YELLOW,
      posX: 120,
      posY: 80,
    });
    await container.useCases.updateStickyNote.execute({
      boardId: created.boardId,
      actorId: alice.user.id,
      noteId: note.id,
      color: StickyNoteColor.GREEN,
    });

    // Activity logs recorded every action
    const logs = await container.useCases.listActivityLogs.execute({
      boardId: created.boardId,
      userId: alice.user.id,
      limit: 50,
    });
    const actionTypes = logs.map((l) => l.actionType);
    expect(actionTypes).toContain(ActivityActionType.TEAM_CREATED);
    expect(actionTypes).toContain(ActivityActionType.MEMBER_JOINED);
    expect(actionTypes).toContain(ActivityActionType.WIP_UPDATED);
    expect(actionTypes).toContain(ActivityActionType.STORY_CREATED);
    expect(actionTypes).toContain(ActivityActionType.TASKS_GENERATED);
    expect(actionTypes).toContain(ActivityActionType.TASK_MOVED);
    expect(actionTypes).toContain(ActivityActionType.NOTE_CREATED);
  });

  it('impede gerações concorrentes simultâneas para a mesma história (lock por história)', async () => {
    let resolveClassifier!: () => void;
    const blockingPromise = new Promise<void>((resolve) => {
      resolveClassifier = resolve;
    });

    const { container } = createTestContainer({
      priorityClassifier: {
        classify: async (_ctx, tasks) => {
          await blockingPromise;
          const { PriorityScore } = await import('../../../src/domain/value-objects/PriorityScore');
          return tasks.map((_, idx) => ({
            taskIndex: idx,
            priority: PriorityScore.create(3, 0.9, {
              businessAlignment: 3,
              technicalDependency: 3,
              userImpact: 3,
              boardUrgency: 3,
            }),
            classifiedByModel: 'gemini-decision-1',
          }));
        },
      },
    });

    const user = await container.useCases.registerUser.execute({
      name: 'Alice',
      email: 'lock@dev.io',
      password: 'Password123!',
    });
    const team = await container.useCases.createTeamWithProject.execute({
      userId: user.user.id,
      teamName: 'Lock Team',
      projectName: 'Lock Proj',
      document: {
        originalName: 'doc.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from('Contexto suficiente para teste de concorrência.', 'utf8'),
      },
    });
    const { story } = await container.useCases.createStory.execute({
      boardId: team.boardId,
      actorId: user.user.id,
      title: 'História concorrente',
    });
    await container.useCases.moveStory.execute({
      boardId: team.boardId,
      actorId: user.user.id,
      storyId: story.id,
      toSubcolumn: SubcolumnType.IN_SPECIFICATION,
      position: 0,
    });

    const firstCall = container.useCases.generateAndPrioritizeTasks.execute({
      boardId: team.boardId,
      actorId: user.user.id,
      storyId: story.id,
      tasks: [{ title: 'Tarefa concorrente 1' }],
    });

    // Second simultaneous click on the same story MUST fail with ConflictError
    await expect(
      container.useCases.generateAndPrioritizeTasks.execute({
        boardId: team.boardId,
        actorId: user.user.id,
        storyId: story.id,
        tasks: [{ title: 'Tarefa concorrente 1' }],
      }),
    ).rejects.toThrow(ConflictError);

    resolveClassifier();
    const firstResult = await firstCall;
    expect(firstResult.tasks).toHaveLength(1);
  });
});
