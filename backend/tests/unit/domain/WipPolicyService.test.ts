import { describe, expect, it } from 'vitest';
import { BoardColumn } from '../../../src/domain/entities/BoardColumn';
import { WipLimitExceededError } from '../../../src/domain/errors';
import { BoardWipState, WipPolicyService } from '../../../src/domain/services/WipPolicyService';
import { ColumnType, SubcolumnType } from '../../../src/domain/value-objects/KanbanStage';

function makeColumns(limits: Partial<Record<ColumnType, number | null>> = {}): BoardColumn[] {
  return [
    { id: 'c1', boardId: 'b1', type: ColumnType.BACKLOG, wipLimit: limits.BACKLOG ?? null, position: 0 },
    { id: 'c2', boardId: 'b1', type: ColumnType.SPECIFICATION, wipLimit: limits.SPECIFICATION ?? null, position: 1 },
    { id: 'c3', boardId: 'b1', type: ColumnType.IMPLEMENTATION, wipLimit: limits.IMPLEMENTATION ?? null, position: 2 },
    { id: 'c4', boardId: 'b1', type: ColumnType.CODE_REVIEW, wipLimit: limits.CODE_REVIEW ?? null, position: 3 },
  ];
}

describe('WipPolicyService', () => {
  const wip = new WipPolicyService();

  it('permite criação sem limite quando wipLimit é null', () => {
    const state: BoardWipState = {
      columns: makeColumns(),
      stories: [
        { id: 'h1', subcolumn: SubcolumnType.BACKLOG },
        { id: 'h2', subcolumn: SubcolumnType.BACKLOG },
      ],
      tasks: [],
    };
    expect(() => wip.assertCanCreateStoryInBacklog(state)).not.toThrow();
  });

  it('conta Backlog por card de História de Usuário e bloqueia ao atingir o limite', () => {
    const state: BoardWipState = {
      columns: makeColumns({ BACKLOG: 2 }),
      stories: [
        { id: 'h1', subcolumn: SubcolumnType.BACKLOG },
        { id: 'h2', subcolumn: SubcolumnType.BACKLOG },
      ],
      tasks: [],
    };
    expect(wip.calculateColumnCount(ColumnType.BACKLOG, state)).toBe(2);
    expect(() => wip.assertCanCreateStoryInBacklog(state)).toThrow(WipLimitExceededError);
  });

  it('conta Especificação como histórias em Em especificação + 1 por linha ativa de tarefas em Especificado', () => {
    const state: BoardWipState = {
      columns: makeColumns({ SPECIFICATION: 2 }),
      stories: [
        { id: 'h1', subcolumn: SubcolumnType.SPECIFIED },
        { id: 'h2', subcolumn: SubcolumnType.IN_SPECIFICATION },
        { id: 'h3', subcolumn: SubcolumnType.BACKLOG },
      ],
      tasks: [
        // 4 tasks originating from H1 in SPECIFIED count as 1 row total!
        { id: 't1', storyId: 'h1', subcolumn: SubcolumnType.SPECIFIED },
        { id: 't2', storyId: 'h1', subcolumn: SubcolumnType.SPECIFIED },
        { id: 't3', storyId: 'h1', subcolumn: SubcolumnType.SPECIFIED },
        { id: 't4', storyId: 'h1', subcolumn: SubcolumnType.SPECIFIED },
      ],
    };

    // 1 (h2 in IN_SPECIFICATION) + 1 (h1's row of 4 tasks in SPECIFIED) = 2
    expect(wip.calculateColumnCount(ColumnType.SPECIFICATION, state)).toBe(2);

    // Trying to move h3 from BACKLOG -> IN_SPECIFICATION must fail (2/2)
    expect(() =>
      wip.assertCanMoveStory({ id: 'h3', subcolumn: SubcolumnType.BACKLOG }, SubcolumnType.IN_SPECIFICATION, state),
    ).toThrow(WipLimitExceededError);

    // Removing 3 of 4 tasks from SPECIFIED keeps count at 2 (still 1 task in h1's row!)
    const afterThreeMoved: BoardWipState = {
      ...state,
      tasks: [
        { id: 't1', storyId: 'h1', subcolumn: SubcolumnType.IN_IMPLEMENTATION },
        { id: 't2', storyId: 'h1', subcolumn: SubcolumnType.IN_IMPLEMENTATION },
        { id: 't3', storyId: 'h1', subcolumn: SubcolumnType.IN_IMPLEMENTATION },
        { id: 't4', storyId: 'h1', subcolumn: SubcolumnType.SPECIFIED },
      ],
    };
    expect(wip.calculateColumnCount(ColumnType.SPECIFICATION, afterThreeMoved)).toBe(2);

    // Removing the LAST task (t4) from h1's row drops SPECIFICATION count from 2 -> 1!
    const afterAllFourMoved: BoardWipState = {
      ...state,
      tasks: [
        { id: 't1', storyId: 'h1', subcolumn: SubcolumnType.IN_IMPLEMENTATION },
        { id: 't2', storyId: 'h1', subcolumn: SubcolumnType.IN_IMPLEMENTATION },
        { id: 't3', storyId: 'h1', subcolumn: SubcolumnType.IN_IMPLEMENTATION },
        { id: 't4', storyId: 'h1', subcolumn: SubcolumnType.IN_IMPLEMENTATION },
      ],
    };
    expect(wip.calculateColumnCount(ColumnType.SPECIFICATION, afterAllFourMoved)).toBe(1);
    expect(() =>
      wip.assertCanMoveStory(
        { id: 'h3', subcolumn: SubcolumnType.BACKLOG },
        SubcolumnType.IN_SPECIFICATION,
        afterAllFourMoved,
      ),
    ).not.toThrow();
  });

  it('permite devolver tarefa para linha já ativa em Especificado sem estourar WIP, mas bloqueia recriar linha quando cheio', () => {
    const stateWithActiveRow: BoardWipState = {
      columns: makeColumns({ SPECIFICATION: 1 }),
      stories: [{ id: 'h1', subcolumn: SubcolumnType.SPECIFIED }],
      tasks: [
        { id: 't1', storyId: 'h1', subcolumn: SubcolumnType.SPECIFIED },
        { id: 't2', storyId: 'h1', subcolumn: SubcolumnType.IN_IMPLEMENTATION },
      ],
    };
    // Moving t2 back into SPECIFIED joins h1's active row (delta = 0) -> allowed!
    expect(() =>
      wip.assertCanMoveTask(
        { id: 't2', storyId: 'h1', subcolumn: SubcolumnType.IN_IMPLEMENTATION },
        SubcolumnType.SPECIFIED,
        stateWithActiveRow,
      ),
    ).not.toThrow();

    const stateWithOtherStoryFull: BoardWipState = {
      columns: makeColumns({ SPECIFICATION: 1 }),
      stories: [
        { id: 'h1', subcolumn: SubcolumnType.SPECIFIED },
        { id: 'h2', subcolumn: SubcolumnType.IN_SPECIFICATION },
      ],
      tasks: [{ id: 't2', storyId: 'h1', subcolumn: SubcolumnType.IN_IMPLEMENTATION }],
    };
    // h1 has 0 tasks in SPECIFIED and h2 occupies 1/1 -> moving t2 back would create a 2nd slot -> blocked!
    expect(() =>
      wip.assertCanMoveTask(
        { id: 't2', storyId: 'h1', subcolumn: SubcolumnType.IN_IMPLEMENTATION },
        SubcolumnType.SPECIFIED,
        stateWithOtherStoryFull,
      ),
    ).toThrow(WipLimitExceededError);
  });

  it('conta Implementação por tarefa nas 2 subcolunas e libera movimento interno Em implementação <-> Implementado', () => {
    const state: BoardWipState = {
      columns: makeColumns({ IMPLEMENTATION: 2 }),
      stories: [],
      tasks: [
        { id: 't1', storyId: 'h1', subcolumn: SubcolumnType.IN_IMPLEMENTATION },
        { id: 't2', storyId: 'h1', subcolumn: SubcolumnType.IMPLEMENTED },
        { id: 't3', storyId: 'h1', subcolumn: SubcolumnType.SPECIFIED },
      ],
    };

    expect(wip.calculateColumnCount(ColumnType.IMPLEMENTATION, state)).toBe(2);

    // Moving t3 from SPECIFIED -> IN_IMPLEMENTATION blocked (2/2)
    expect(() =>
      wip.assertCanMoveTask(
        { id: 't3', storyId: 'h1', subcolumn: SubcolumnType.SPECIFIED },
        SubcolumnType.IN_IMPLEMENTATION,
        state,
      ),
    ).toThrow(WipLimitExceededError);

    // Moving t1 from IN_IMPLEMENTATION -> IMPLEMENTED stays in same parent column -> allowed!
    expect(() =>
      wip.assertCanMoveTask(
        { id: 't1', storyId: 'h1', subcolumn: SubcolumnType.IN_IMPLEMENTATION },
        SubcolumnType.IMPLEMENTED,
        state,
      ),
    ).not.toThrow();
  });

  it('conta Revisão de Código apenas em Em revisão, excluindo Revisado do WIP', () => {
    const state: BoardWipState = {
      columns: makeColumns({ CODE_REVIEW: 1 }),
      stories: [],
      tasks: [
        { id: 't1', storyId: 'h1', subcolumn: SubcolumnType.REVIEWED },
        { id: 't2', storyId: 'h1', subcolumn: SubcolumnType.REVIEWED },
        { id: 't3', storyId: 'h1', subcolumn: SubcolumnType.IN_REVIEW },
        { id: 't4', storyId: 'h1', subcolumn: SubcolumnType.IMPLEMENTED },
      ],
    };

    // Only t3 in IN_REVIEW counts (t1 and t2 in REVIEWED are ignored!)
    expect(wip.calculateColumnCount(ColumnType.CODE_REVIEW, state)).toBe(1);

    // Moving t4 -> IN_REVIEW is blocked (1/1)
    expect(() =>
      wip.assertCanMoveTask(
        { id: 't4', storyId: 'h1', subcolumn: SubcolumnType.IMPLEMENTED },
        SubcolumnType.IN_REVIEW,
        state,
      ),
    ).toThrow(WipLimitExceededError);

    // Moving t3 -> REVIEWED is ALWAYS allowed
    expect(() =>
      wip.assertCanMoveTask(
        { id: 't3', storyId: 'h1', subcolumn: SubcolumnType.IN_REVIEW },
        SubcolumnType.REVIEWED,
        state,
      ),
    ).not.toThrow();

    // Moving a REVIEWED task BACK to IN_REVIEW checks WIP (1/1 -> blocked!)
    expect(() =>
      wip.assertCanMoveTask(
        { id: 't1', storyId: 'h1', subcolumn: SubcolumnType.REVIEWED },
        SubcolumnType.IN_REVIEW,
        state,
      ),
    ).toThrow(WipLimitExceededError);
  });
});
