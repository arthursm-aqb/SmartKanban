import { Server as SocketIoServer } from 'socket.io';
import {
  BoardRealtimeEvent,
  IRealtimePublisher,
} from '../../application/ports/services/IRealtimePublisher';

export class SocketIoRealtimePublisher implements IRealtimePublisher {
  private io: SocketIoServer | null = null;

  public bindServer(io: SocketIoServer): void {
    this.io = io;
  }

  public publishToBoard(boardId: string, event: BoardRealtimeEvent, payload: unknown): void {
    if (!this.io) return;
    this.io.to(`board:${boardId}`).emit(event, payload);
  }
}
