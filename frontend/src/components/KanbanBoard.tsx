import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Edit3,
  GripVertical,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useBoardRealtime } from '../contexts/BoardRealtimeContext';
import {
  BoardSnapshot,
  COLUMN_LABELS,
  ColumnType,
  SUBCOLUMN_LABELS,
  SubcolumnType,
  Task,
  UserStory,
} from '../types/kanban';
import { PriorityBadge } from './PriorityBadge';
import { SpecifyTasksDialog } from './SpecifyTasksDialog';
import { StoryModal } from './StoryModal';
import { TaskModal } from './TaskModal';
import { WipConfigDialog } from './WipConfigDialog';

const TASK_FLOW: Array<'SPECIFIED' | 'IN_IMPLEMENTATION' | 'IMPLEMENTED' | 'IN_REVIEW' | 'REVIEWED'> = [
  'SPECIFIED',
  'IN_IMPLEMENTATION',
  'IMPLEMENTED',
  'IN_REVIEW',
  'REVIEWED',
];

function DroppableSubcolumn({
  id,
  title,
  badgeText,
  children,
}: {
  id: SubcolumnType;
  title: string;
  badgeText?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={`subcolumn-zone ${isOver ? 'subcolumn-zone-over' : ''}`}
    >
      <div className="subcolumn-header">
        <span>{title}</span>
        {badgeText && <span className="mono">{badgeText}</span>}
      </div>
      {children}
    </section>
  );
}

function DraggableStoryCard({
  story,
  onClickSpecify,
  onEdit,
  onDelete,
  onMove,
}: {
  story: UserStory;
  onClickSpecify?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (to: 'BACKLOG' | 'IN_SPECIFICATION') => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `story:${story.id}`,
    data: { kind: 'story', story },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  };

  const isInSpec = story.subcolumn === 'IN_SPECIFICATION';

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`kanban-card ${isInSpec ? 'kanban-card-clickable' : ''}`}
      onClick={() => {
        if (isInSpec && onClickSpecify) onClickSpecify();
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <button
            type="button"
            className="win-btn win-btn-icon"
            aria-label={`Arrastar história ${story.title}`}
            onClick={(e) => e.stopPropagation()}
            {...listeners}
            {...attributes}
          >
            <GripVertical size={13} aria-hidden="true" />
          </button>
          <strong style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>{story.title}</strong>
        </div>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="win-btn win-btn-icon"
            aria-label={`Editar história ${story.title}`}
            onClick={onEdit}
          >
            <Edit3 size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="win-btn win-btn-icon win-btn-danger"
            aria-label={`Excluir história ${story.title}`}
            onClick={onDelete}
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        </div>
      </div>

      {story.description && (
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--win-muted)' }}>
          {story.description}
        </p>
      )}

      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--win-muted)' }}>
          {story.authorName ?? 'Membro'}
        </span>

        {story.subcolumn === 'BACKLOG' ? (
          <button
            type="button"
            className="win-btn"
            style={{ minHeight: 26, padding: '2px 8px', fontSize: '0.78rem' }}
            onClick={() => onMove('IN_SPECIFICATION')}
          >
            Especificar <ArrowRight size={12} aria-hidden="true" />
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="win-btn"
              style={{ minHeight: 26, padding: '2px 7px', fontSize: '0.76rem' }}
              onClick={() => onMove('BACKLOG')}
              aria-label={`Voltar história ${story.title} para Backlog`}
            >
              <ArrowLeft size={12} aria-hidden="true" /> Backlog
            </button>
            {onClickSpecify && (
              <button
                type="button"
                className="win-btn win-btn-primary"
                style={{ minHeight: 26, padding: '2px 8px', fontSize: '0.76rem' }}
                onClick={onClickSpecify}
              >
                <Sparkles size={12} aria-hidden="true" /> Gerar Tarefas
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function DraggableTaskCard({
  task,
  storyTitle,
  onEdit,
  onDelete,
  onMove,
}: {
  task: Task;
  storyTitle?: string;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (to: 'SPECIFIED' | 'IN_IMPLEMENTATION' | 'IMPLEMENTED' | 'IN_REVIEW' | 'REVIEWED') => void;
}) {
  const isReviewed = task.subcolumn === 'REVIEWED';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { kind: 'task', task },
    disabled: isReviewed,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  };

  const flowIndex = TASK_FLOW.indexOf(
    task.subcolumn as 'SPECIFIED' | 'IN_IMPLEMENTATION' | 'IMPLEMENTED' | 'IN_REVIEW' | 'REVIEWED',
  );
  const prevStage = !isReviewed && flowIndex > 0 ? TASK_FLOW[flowIndex - 1] : null;
  const nextStage =
    !isReviewed && flowIndex >= 0 && flowIndex < TASK_FLOW.length - 1
      ? TASK_FLOW[flowIndex + 1]
      : null;

  return (
    <article ref={setNodeRef} style={style} className="kanban-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {!isReviewed && (
            <button
              type="button"
              className="win-btn win-btn-icon"
              aria-label={`Arrastar tarefa ${task.title}`}
              {...listeners}
              {...attributes}
            >
              <GripVertical size={13} aria-hidden="true" />
            </button>
          )}
          <strong style={{ fontSize: '0.88rem', wordBreak: 'break-word' }}>{task.title}</strong>
        </div>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            type="button"
            className="win-btn win-btn-icon"
            aria-label={`Editar tarefa ${task.title}`}
            onClick={onEdit}
          >
            <Edit3 size={12} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="win-btn win-btn-icon win-btn-danger"
            aria-label={`Excluir tarefa ${task.title}`}
            onClick={onDelete}
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        </div>
      </div>

      <PriorityBadge
        score={task.priorityScore}
        confidence={task.priorityConfidence}
        criteria={task.priorityCriteria}
        model={task.classifiedByModel}
      />

      {task.description && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--win-muted)' }}>{task.description}</p>
      )}

      {storyTitle && task.subcolumn !== 'SPECIFIED' && (
        <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--win-muted)' }}>
          História: {storyTitle}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
        {prevStage ? (
          <button
            type="button"
            className="win-btn"
            style={{ minHeight: 24, padding: '2px 6px', fontSize: '0.74rem' }}
            onClick={() => onMove(prevStage)}
            aria-label={`Mover ${task.title} para ${SUBCOLUMN_LABELS[prevStage]}`}
          >
            <ArrowLeft size={11} aria-hidden="true" /> {SUBCOLUMN_LABELS[prevStage]}
          </button>
        ) : (
          <span />
        )}

        {nextStage && (
          <button
            type="button"
            className="win-btn win-btn-primary"
            style={{ minHeight: 24, padding: '2px 7px', fontSize: '0.74rem' }}
            onClick={() => onMove(nextStage)}
            aria-label={`Mover ${task.title} para ${SUBCOLUMN_LABELS[nextStage]}`}
          >
            {SUBCOLUMN_LABELS[nextStage]} <ArrowRight size={11} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}

export function KanbanBoardView({
  snapshot,
  actions,
}: {
  snapshot: BoardSnapshot;
  actions: {
    updateWip: (col: ColumnType, limit: number | null) => Promise<void>;
    createStory: (title: string, description?: string) => Promise<void>;
    updateStory: (id: string, data: { title?: string; description?: string }) => Promise<void>;
    moveStory: (id: string, to: 'BACKLOG' | 'IN_SPECIFICATION', pos: number) => Promise<void>;
    deleteStory: (id: string) => Promise<void>;
    generateTasks: (storyId: string, tasks: Array<{ title: string; description?: string }>) => Promise<void>;
    reprioritizeTasks: (storyId: string) => Promise<void>;
    updateTask: (id: string, data: { title?: string; description?: string }) => Promise<void>;
    moveTask: (
      id: string,
      to: 'SPECIFIED' | 'IN_IMPLEMENTATION' | 'IMPLEMENTED' | 'IN_REVIEW' | 'REVIEWED',
      pos: number,
    ) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
  };
}) {
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<UserStory | null>(null);
  const [specifyStory, setSpecifyStory] = useState<UserStory | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [wipConfigTarget, setWipConfigTarget] = useState<{
    type: ColumnType;
    currentLimit: number | null;
    currentCount: number;
  } | null>(null);
  const [reprioritizingId, setReprioritizingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const storiesById = useMemo(
    () => new Map(snapshot.stories.map((story) => [story.id, story])),
    [snapshot.stories],
  );

  const backlogStories = snapshot.stories.filter((s) => s.subcolumn === 'BACKLOG');
  const inSpecStories = snapshot.stories.filter((s) => s.subcolumn === 'IN_SPECIFICATION');
  const specifiedTasks = snapshot.tasks.filter((t) => t.subcolumn === 'SPECIFIED');
  const inImplTasks = snapshot.tasks.filter((t) => t.subcolumn === 'IN_IMPLEMENTATION');
  const implementedTasks = snapshot.tasks.filter((t) => t.subcolumn === 'IMPLEMENTED');
  const inReviewTasks = snapshot.tasks.filter((t) => t.subcolumn === 'IN_REVIEW');
  const reviewedTasks = snapshot.tasks.filter((t) => t.subcolumn === 'REVIEWED');

  // Group SPECIFIED tasks into 1 row per originating UserStory, ordered highest priority first
  const specifiedRows = useMemo(() => {
    const groups = new Map<string, Task[]>();
    for (const task of specifiedTasks) {
      const list = groups.get(task.storyId) ?? [];
      list.push(task);
      groups.set(task.storyId, list);
    }
    return Array.from(groups.entries())
      .map(([storyId, tasks]) => {
        const sortedTasks = [...tasks].sort(
          (a, b) =>
            b.priorityScore - a.priorityScore ||
            b.priorityConfidence - a.priorityConfidence ||
            a.position - b.position,
        );
        return {
          story: storiesById.get(storyId),
          storyId,
          maxPriority: sortedTasks[0]?.priorityScore ?? 0,
          tasks: sortedTasks,
        };
      })
      .sort((a, b) => b.maxPriority - a.maxPriority);
  }, [specifiedTasks, storiesById]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const targetSubcolumn = over.id as SubcolumnType;
    const data = active.data.current as
      | { kind: 'story'; story: UserStory }
      | { kind: 'task'; task: Task }
      | undefined;
    if (!data) return;

    if (data.kind === 'story') {
      if (data.story.subcolumn === targetSubcolumn) return;
      if (targetSubcolumn === 'BACKLOG' || targetSubcolumn === 'IN_SPECIFICATION') {
        await actions.moveStory(data.story.id, targetSubcolumn, 0).catch(() => {});
      }
      return;
    }

    if (data.kind === 'task') {
      if (data.task.subcolumn === 'REVIEWED') return;
      if (data.task.subcolumn === targetSubcolumn) return;
      if (
        targetSubcolumn === 'SPECIFIED' ||
        targetSubcolumn === 'IN_IMPLEMENTATION' ||
        targetSubcolumn === 'IMPLEMENTED' ||
        targetSubcolumn === 'IN_REVIEW' ||
        targetSubcolumn === 'REVIEWED'
      ) {
        await actions.moveTask(data.task.id, targetSubcolumn, 0).catch(() => {});
      }
    }
  };

  const renderColumnHeader = (columnType: ColumnType, extraControls?: React.ReactNode) => {
    const occ = snapshot.wipOccupancy[columnType];
    const limitStr = occ.wipLimit === null ? '∞' : String(occ.wipLimit);
    return (
      <div className="kanban-column-header">
        <div className="kanban-column-title-row">
          <strong style={{ fontSize: '0.96rem' }}>{COLUMN_LABELS[columnType]}</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              className={`wip-pill ${occ.isFull ? 'wip-pill-full' : ''}`}
              aria-label={`WIP ${COLUMN_LABELS[columnType]}: ${occ.currentCount} de ${limitStr}`}
            >
              {occ.isFull && <AlertTriangle size={12} aria-hidden="true" />}
              {occ.currentCount}/{limitStr}
            </span>
            <button
              type="button"
              className="win-btn win-btn-icon"
              aria-label={`Configurar WIP de ${COLUMN_LABELS[columnType]}`}
              onClick={() =>
                setWipConfigTarget({
                  type: columnType,
                  currentLimit: occ.wipLimit,
                  currentCount: occ.currentCount,
                })
              }
            >
              <Settings size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
        {extraControls}
      </div>
    );
  };

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={(e) => void handleDragEnd(e)}>
        <div className="kanban-grid">
          {/* 1. BACKLOG */}
          <div className="kanban-column" data-testid="column-BACKLOG">
            {renderColumnHeader(
              'BACKLOG',
              <button
                type="button"
                className="win-btn win-btn-primary"
                style={{ width: '100%', minHeight: 30, fontSize: '0.82rem' }}
                onClick={() => {
                  setEditingStory(null);
                  setStoryModalOpen(true);
                }}
              >
                <Plus size={14} aria-hidden="true" /> Nova História de Usuário
              </button>,
            )}
            <div className="subcolumns-stack">
              <DroppableSubcolumn
                id="BACKLOG"
                title="Histórias no Backlog"
                badgeText={`${backlogStories.length} hist.`}
              >
                {backlogStories.length === 0 ? (
                  <p className="win-hint" style={{ margin: '8px 0' }}>
                    Nenhuma história no Backlog. Crie a primeira acima.
                  </p>
                ) : (
                  backlogStories.map((story) => (
                    <DraggableStoryCard
                      key={story.id}
                      story={story}
                      onEdit={() => {
                        setEditingStory(story);
                        setStoryModalOpen(true);
                      }}
                      onDelete={() => void actions.deleteStory(story.id).catch(() => {})}
                      onMove={(to) => void actions.moveStory(story.id, to, 0).catch(() => {})}
                    />
                  ))
                )}
              </DroppableSubcolumn>
            </div>
          </div>

          {/* 2. ESPECIFICAÇÃO */}
          <div className="kanban-column" data-testid="column-SPECIFICATION">
            {renderColumnHeader('SPECIFICATION')}
            <div className="subcolumns-stack subcolumns-split">
              <DroppableSubcolumn
                id="IN_SPECIFICATION"
                title="Em especificação"
                badgeText={`${inSpecStories.length} hist.`}
              >
                {inSpecStories.length === 0 ? (
                  <p className="win-hint" style={{ margin: '8px 0', fontSize: '0.78rem' }}>
                    Mova uma história do Backlog e clique nela para gerar tarefas.
                  </p>
                ) : (
                  inSpecStories.map((story) => (
                    <DraggableStoryCard
                      key={story.id}
                      story={story}
                      onClickSpecify={() => setSpecifyStory(story)}
                      onEdit={() => {
                        setEditingStory(story);
                        setStoryModalOpen(true);
                      }}
                      onDelete={() => void actions.deleteStory(story.id).catch(() => {})}
                      onMove={(to) => void actions.moveStory(story.id, to, 0).catch(() => {})}
                    />
                  ))
                )}
              </DroppableSubcolumn>

              <DroppableSubcolumn
                id="SPECIFIED"
                title="Especificado"
                badgeText={`${specifiedRows.length} linha(s)`}
              >
                {specifiedRows.length === 0 ? (
                  <p className="win-hint" style={{ margin: '8px 0', fontSize: '0.78rem' }}>
                    As linhas de tarefas priorizadas (0–5) aparecerão aqui.
                  </p>
                ) : (
                  specifiedRows.map((row) => (
                    <div
                      key={row.storyId}
                      className="story-task-row"
                      data-testid={`specified-row-${row.storyId}`}
                    >
                      <div className="story-task-row-header">
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                            {row.story?.title ?? 'História especificada'}
                          </div>
                          <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--win-muted)' }}>
                            Linha com {row.tasks.length} tarefa(s) • conta 1 no WIP
                          </div>
                        </div>
                        <button
                          type="button"
                          className="win-btn win-btn-icon"
                          aria-label={`Reclassificar tarefas de ${row.story?.title ?? 'história'}`}
                          disabled={reprioritizingId === row.storyId}
                          onClick={() => {
                            setReprioritizingId(row.storyId);
                            void actions
                              .reprioritizeTasks(row.storyId)
                              .catch(() => {})
                              .finally(() => setReprioritizingId(null));
                          }}
                        >
                          <RefreshCw size={12} aria-hidden="true" />
                        </button>
                      </div>

                      {row.tasks.map((task) => (
                        <DraggableTaskCard
                          key={task.id}
                          task={task}
                          onEdit={() => setEditingTask(task)}
                          onDelete={() => void actions.deleteTask(task.id).catch(() => {})}
                          onMove={(to) => void actions.moveTask(task.id, to, 0).catch(() => {})}
                        />
                      ))}
                    </div>
                  ))
                )}
              </DroppableSubcolumn>
            </div>
          </div>

          {/* 3. IMPLEMENTAÇÃO */}
          <div className="kanban-column" data-testid="column-IMPLEMENTATION">
            {renderColumnHeader('IMPLEMENTATION')}
            <div className="subcolumns-stack subcolumns-split">
              <DroppableSubcolumn
                id="IN_IMPLEMENTATION"
                title="Em implementação"
                badgeText={`${inImplTasks.length} tar.`}
              >
                {inImplTasks.map((task) => (
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    storyTitle={storiesById.get(task.storyId)?.title}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => void actions.deleteTask(task.id).catch(() => {})}
                    onMove={(to) => void actions.moveTask(task.id, to, 0).catch(() => {})}
                  />
                ))}
              </DroppableSubcolumn>

              <DroppableSubcolumn
                id="IMPLEMENTED"
                title="Implementado"
                badgeText={`${implementedTasks.length} tar.`}
              >
                {implementedTasks.map((task) => (
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    storyTitle={storiesById.get(task.storyId)?.title}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => void actions.deleteTask(task.id).catch(() => {})}
                    onMove={(to) => void actions.moveTask(task.id, to, 0).catch(() => {})}
                  />
                ))}
              </DroppableSubcolumn>
            </div>
          </div>

          {/* 4. REVISÃO DE CÓDIGO */}
          <div className="kanban-column" data-testid="column-CODE_REVIEW">
            {renderColumnHeader('CODE_REVIEW')}
            <div className="subcolumns-stack subcolumns-split">
              <DroppableSubcolumn
                id="IN_REVIEW"
                title="Em revisão"
                badgeText={`${inReviewTasks.length} tar.`}
              >
                {inReviewTasks.map((task) => (
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    storyTitle={storiesById.get(task.storyId)?.title}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => void actions.deleteTask(task.id).catch(() => {})}
                    onMove={(to) => void actions.moveTask(task.id, to, 0).catch(() => {})}
                  />
                ))}
              </DroppableSubcolumn>

              <DroppableSubcolumn
                id="REVIEWED"
                title="Revisado"
                badgeText={`${reviewedTasks.length} tar.`}
              >
                {reviewedTasks.map((task) => (
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    storyTitle={storiesById.get(task.storyId)?.title}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => void actions.deleteTask(task.id).catch(() => {})}
                    onMove={(to) => void actions.moveTask(task.id, to, 0).catch(() => {})}
                  />
                ))}
              </DroppableSubcolumn>
            </div>
          </div>
        </div>
      </DndContext>

      <StoryModal
        open={storyModalOpen}
        initialData={editingStory}
        onClose={() => {
          setStoryModalOpen(false);
          setEditingStory(null);
        }}
        onSubmit={async (data) => {
          if (editingStory) {
            await actions.updateStory(editingStory.id, data);
          } else {
            await actions.createStory(data.title, data.description);
          }
        }}
      />

      <SpecifyTasksDialog
        story={specifyStory}
        onClose={() => setSpecifyStory(null)}
        onGenerate={actions.generateTasks}
      />

      <TaskModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={actions.updateTask}
      />

      <WipConfigDialog
        column={wipConfigTarget}
        onClose={() => setWipConfigTarget(null)}
        onSave={actions.updateWip}
      />
    </>
  );
}

export function KanbanBoard() {
  const {
    snapshot,
    updateWip,
    createStory,
    updateStory,
    moveStory,
    deleteStory,
    generateTasks,
    reprioritizeTasks,
    updateTask,
    moveTask,
    deleteTask,
  } = useBoardRealtime();

  if (!snapshot) return null;

  return (
    <KanbanBoardView
      snapshot={snapshot}
      actions={{
        updateWip,
        createStory,
        updateStory,
        moveStory,
        deleteStory,
        generateTasks,
        reprioritizeTasks,
        updateTask,
        moveTask,
        deleteTask,
      }}
    />
  );
}
