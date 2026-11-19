import { io, Socket } from 'socket.io-client';
import { SocketAckResponse } from '../types/kanban';
import { getApiBaseUrl } from './apiClient';

export function createBoardSocket(): Socket {
  const baseUrl = getApiBaseUrl();
  return io(baseUrl || undefined, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnectionAttempts: 5,
  });
}

export function emitSocketCommand<T>(
  socket: Socket,
  event: string,
  payload: unknown,
): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(15000).emit(event, payload, (err: Error | null, res: SocketAckResponse<T>) => {
      if (err) {
        reject(new Error('Tempo esgotado na comunicação WebSocket com o servidor.'));
        return;
      }
      if (!res || !res.ok) {
        const msg = res?.message ?? 'Falha ao executar comando no quadro Kanban.';
        reject(new Error(msg));
        return;
      }
      resolve(res.data);
    });
  });
}
