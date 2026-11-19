import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { apiFetch } from '../services/apiClient';
import { createBoardSocket, emitSocketCommand } from '../services/socketClient';
import {
  ActivityLog,
  BoardColumn,
  BoardSnapshot,
  ColumnType,
  ColumnWipOccupancy,
  OnlineUser,
  StickyNote,
  StickyNoteColor,
  Task,
  TeamMember,
  UserStory,
} from '../types/kanban';

export type WsConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface BoardRealtimeContextValue {
  snapshot: BoardSnapshot | null;
  onlineUsers: OnlineUser[];
  wsStatus: WsConnectionStatus;
  errorMessage: string | null;
  statusBanner: string;
  clearError: () => void;
  updateWip: (columnType: ColumnType, wipLimit: number | null) => Promise<void>;
  createStory: (title: string, description?: string) => Promise<void>;
  updateStory: (storyId: string, data: { title?: string; description?: string }) => Promise<void>;
  moveStory: (
    storyId: string,
    toSubcolumn: 'BACKLOG' | 'IN_SPECIFICATION',
    position: number,
  ) => Promise<void>;
  deleteStory: (storyId: string) => Promise<void>;
  generateTasks: (
    storyId: string,
    tasks: Array<{ title: string; description?: string }>,
  ) => Promise<void>;
  reprioritizeTasks: (storyId: string) => Promise<void>;
  updateTask: (taskId: string, data: { title?: string; description?: string }) => Promise<void>;
  moveTask: (
    taskId: string,
    toSubcolumn:
      | 'SPECIFIED'
      | 'IN_IMPLEMENTATION'
      | 'IMPLEMENTED'
      | 'IN_REVIEW'
      | 'REVIEWED',
    position: number,
  ) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  createNote: (input: {
    content: string;
    color: StickyNoteColor;
    posX: number;
    posY: number;
  }) => Promise<void>;
  updateNote: (
    noteId: string,
    data: { content?: string; color?: StickyNoteColor; posX?: number; posY?: number },
  ) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  fetchActivityLogs: (filters?: { actorId?: string; actionType?: string }) => Promise<ActivityLog[]>;
}

const BoardRealtimeContext = createContext<BoardRealtimeContextValue | null>(null);

export function BoardRealtimeProvider({
  boardId,
  children,
}: {
  boardId: string;
  children: React.ReactNode;
}) {
  const socketRef = useRef<Socket | null>(null);
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [wsStatus, setWsStatus] = useState<WsConnectionStatus>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string>('Conectando via WebSocket...');

  const clearError = useCallback(() => setErrorMessage(null), []);

  useEffect(() => {
    let active = true;
    setWsStatus('connecting');
    setErrorMessage(null);

    const socket = createBoardSocket();
    socketRef.current = socket;

    const joinBoard = async () => {
      try {
        const joined = await emitSocketCommand<BoardSnapshot>(socket, 'board:join', { boardId });
        if (!active) return;
        setSnapshot(joined);
        setOnlineUsers(joined.onlineUsers ?? []);
        setWsStatus('connected');
        setStatusBanner(`Conectado em "${joined.project.name}" via WebSocket`);
      } catch (err) {
        if (!active) return;
        setWsStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Falha ao entrar no quadro.');
      }
    };

    socket.on('connect', () => {
      void joinBoard();
    });

    socket.on('connect_error', async (err) => {
      if (!active) return;
      if (err.message === 'UNAUTHORIZED') {
        try {
          await apiFetch('/api/auth/refresh', { method: 'POST', skipAutoRefresh: true });
          socket.connect();
          return;
        } catch {
          // Session truly expired
        }
      }
      setWsStatus('error');
      setErrorMessage(
        err.message === 'UNAUTHORIZED'
          ? 'Sessão expirada. Faça login novamente.'
          : `Erro na conexão WebSocket: ${err.message}`,
      );
    });

    socket.on('disconnect', () => {
      if (!active) return;
      setWsStatus('disconnected');
      setStatusBanner('WebSocket desconectado');
    });

    socket.on('board:presence_updated', (payload: { users: OnlineUser[] }) => {
      setOnlineUsers(payload.users);
    });

    socket.on(
      'board:wip_updated',
      (payload: { column: BoardColumn; wipOccupancy: Record<ColumnType, ColumnWipOccupancy> }) => {
        setSnapshot((prev) =>
          prev
            ? {
                ...prev,
                columns: prev.columns.map((c) => (c.id === payload.column.id ? payload.column : c)),
                wipOccupancy: payload.wipOccupancy,
              }
            : prev,
        );
      },
    );

    socket.on(
      'board:story_created',
      (payload: { story: UserStory; wipOccupancy: Record<ColumnType, ColumnWipOccupancy> }) => {
        setSnapshot((prev) => {
          if (!prev) return prev;
          const exists = prev.stories.some((s) => s.id === payload.story.id);
          return {
            ...prev,
            stories: exists ? prev.stories : [...prev.stories, payload.story],
            wipOccupancy: payload.wipOccupancy,
          };
        });
      },
    );

    socket.on('board:story_updated', (payload: { story: UserStory }) => {
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              stories: prev.stories.map((s) => (s.id === payload.story.id ? payload.story : s)),
            }
          : prev,
      );
    });

    socket.on(
      'board:story_moved',
      (payload: { story: UserStory; wipOccupancy: Record<ColumnType, ColumnWipOccupancy> }) => {
        setSnapshot((prev) =>
          prev
            ? {
                ...prev,
                stories: prev.stories.map((s) => (s.id === payload.story.id ? payload.story : s)),
                wipOccupancy: payload.wipOccupancy,
              }
            : prev,
        );
      },
    );

    socket.on(
      'board:story_deleted',
      (payload: { storyId: string; wipOccupancy: Record<ColumnType, ColumnWipOccupancy> }) => {
        setSnapshot((prev) =>
          prev
            ? {
                ...prev,
                stories: prev.stories.filter((s) => s.id !== payload.storyId),
                tasks: prev.tasks.filter((t) => t.storyId !== payload.storyId),
                wipOccupancy: payload.wipOccupancy,
              }
            : prev,
        );
      },
    );

    socket.on(
      'board:tasks_generated',
      (payload: {
        story: UserStory;
        tasks: Task[];
        wipOccupancy: Record<ColumnType, ColumnWipOccupancy>;
      }) => {
        setSnapshot((prev) => {
          if (!prev) return prev;
          const existingIds = new Set(prev.tasks.map((t) => t.id));
          const newTasks = payload.tasks.filter((t) => !existingIds.has(t.id));
          return {
            ...prev,
            stories: prev.stories.map((s) => (s.id === payload.story.id ? payload.story : s)),
            tasks: [...prev.tasks, ...newTasks],
            wipOccupancy: payload.wipOccupancy,
          };
        });
      },
    );

    socket.on('board:tasks_reprioritized', (payload: { storyId: string; tasks: Task[] }) => {
      setSnapshot((prev) => {
        if (!prev) return prev;
        const mapUpdated = new Map(payload.tasks.map((t) => [t.id, t]));
        return {
          ...prev,
          tasks: prev.tasks.map((t) => mapUpdated.get(t.id) ?? t),
        };
      });
    });

    socket.on('board:task_updated', (payload: { task: Task }) => {
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) => (t.id === payload.task.id ? payload.task : t)),
            }
          : prev,
      );
    });

    socket.on(
      'board:task_moved',
      (payload: { task: Task; wipOccupancy: Record<ColumnType, ColumnWipOccupancy> }) => {
        setSnapshot((prev) =>
          prev
            ? {
                ...prev,
                tasks: prev.tasks.map((t) => (t.id === payload.task.id ? payload.task : t)),
                wipOccupancy: payload.wipOccupancy,
              }
            : prev,
        );
      },
    );

    socket.on(
      'board:task_deleted',
      (payload: { taskId: string; wipOccupancy: Record<ColumnType, ColumnWipOccupancy> }) => {
        setSnapshot((prev) =>
          prev
            ? {
                ...prev,
                tasks: prev.tasks.filter((t) => t.id !== payload.taskId),
                wipOccupancy: payload.wipOccupancy,
              }
            : prev,
        );
      },
    );

    socket.on('board:note_created', (payload: { note: StickyNote }) => {
      setSnapshot((prev) => {
        if (!prev) return prev;
        const exists = prev.notes.some((n) => n.id === payload.note.id);
        return { ...prev, notes: exists ? prev.notes : [...prev.notes, payload.note] };
      });
    });

    socket.on('board:note_updated', (payload: { note: StickyNote }) => {
      setSnapshot((prev) =>
        prev
          ? { ...prev, notes: prev.notes.map((n) => (n.id === payload.note.id ? payload.note : n)) }
          : prev,
      );
    });

    socket.on('board:note_deleted', (payload: { noteId: string }) => {
      setSnapshot((prev) =>
        prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== payload.noteId) } : prev,
      );
    });

    socket.on('board:member_joined', (payload: { member: TeamMember }) => {
      setSnapshot((prev) => {
        if (!prev) return prev;
        const exists = prev.members.some((m) => m.id === payload.member.id);
        return { ...prev, members: exists ? prev.members : [...prev.members, payload.member] };
      });
    });

    socket.on('board:activity_logged', (payload: { log: ActivityLog }) => {
      setStatusBanner(payload.log.summary);
      setSnapshot((prev) => {
        if (!prev) return prev;
        const exists = prev.activityLogs.some((l) => l.id === payload.log.id);
        if (exists) return prev;
        return {
          ...prev,
          activityLogs: [payload.log, ...prev.activityLogs].slice(0, 100),
        };
      });
    });

    return () => {
      active = false;
      socket.emit('board:leave');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [boardId]);

  const sendCommand = useCallback(async <T,>(event: string, payload: unknown): Promise<T> => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      const msg = 'WebSocket desconectado. Aguarde a reconexão.';
      setErrorMessage(msg);
      throw new Error(msg);
    }
    try {
      setErrorMessage(null);
      return await emitSocketCommand<T>(socket, event, payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao executar comando.';
      setErrorMessage(msg);
      throw err;
    }
  }, []);

  const updateWip = useCallback(
    async (columnType: ColumnType, wipLimit: number | null) => {
      await sendCommand('board:update_wip', { columnType, wipLimit });
    },
    [sendCommand],
  );

  const createStory = useCallback(
    async (title: string, description?: string) => {
      await sendCommand('story:create', { title, description });
    },
    [sendCommand],
  );

  const updateStory = useCallback(
    async (storyId: string, data: { title?: string; description?: string }) => {
      await sendCommand('story:update', { storyId, ...data });
    },
    [sendCommand],
  );

  const moveStory = useCallback(
    async (
      storyId: string,
      toSubcolumn: 'BACKLOG' | 'IN_SPECIFICATION',
      position: number,
    ) => {
      await sendCommand('story:move', { storyId, toSubcolumn, position });
    },
    [sendCommand],
  );

  const deleteStory = useCallback(
    async (storyId: string) => {
      await sendCommand('story:delete', { storyId });
    },
    [sendCommand],
  );

  const generateTasks = useCallback(
    async (storyId: string, tasks: Array<{ title: string; description?: string }>) => {
      await sendCommand('story:generate_tasks', { storyId, tasks });
    },
    [sendCommand],
  );

  const reprioritizeTasks = useCallback(
    async (storyId: string) => {
      await sendCommand('task:reprioritize', { storyId });
    },
    [sendCommand],
  );

  const updateTask = useCallback(
    async (taskId: string, data: { title?: string; description?: string }) => {
      await sendCommand('task:update', { taskId, ...data });
    },
    [sendCommand],
  );

  const moveTask = useCallback(
    async (
      taskId: string,
      toSubcolumn:
        | 'SPECIFIED'
        | 'IN_IMPLEMENTATION'
        | 'IMPLEMENTED'
        | 'IN_REVIEW'
        | 'REVIEWED',
      position: number,
    ) => {
      await sendCommand('task:move', { taskId, toSubcolumn, position });
    },
    [sendCommand],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      await sendCommand('task:delete', { taskId });
    },
    [sendCommand],
  );

  const createNote = useCallback(
    async (input: { content: string; color: StickyNoteColor; posX: number; posY: number }) => {
      await sendCommand('note:create', input);
    },
    [sendCommand],
  );

  const updateNote = useCallback(
    async (
      noteId: string,
      data: { content?: string; color?: StickyNoteColor; posX?: number; posY?: number },
    ) => {
      await sendCommand('note:update', { noteId, ...data });
    },
    [sendCommand],
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      await sendCommand('note:delete', { noteId });
    },
    [sendCommand],
  );

  const fetchActivityLogs = useCallback(
    async (filters: { actorId?: string; actionType?: string } = {}) => {
      const res = await sendCommand<{ logs: ActivityLog[] }>('activity:list', {
        limit: 100,
        ...(filters.actorId ? { actorId: filters.actorId } : {}),
        ...(filters.actionType ? { actionType: filters.actionType } : {}),
      });
      return res.logs;
    },
    [sendCommand],
  );

  return (
    <BoardRealtimeContext.Provider
      value={{
        snapshot,
        onlineUsers,
        wsStatus,
        errorMessage,
        statusBanner,
        clearError,
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
        createNote,
        updateNote,
        deleteNote,
        fetchActivityLogs,
      }}
    >
      {children}
    </BoardRealtimeContext.Provider>
  );
}

export function useBoardRealtime(): BoardRealtimeContextValue {
  const ctx = useContext(BoardRealtimeContext);
  if (!ctx) throw new Error('useBoardRealtime deve ser usado dentro de BoardRealtimeProvider.');
  return ctx;
}
