export type BoardRealtimeEvent =
  | 'board:wip_updated'
  | 'board:story_created'
  | 'board:story_updated'
  | 'board:story_moved'
  | 'board:story_deleted'
  | 'board:tasks_generated'
  | 'board:tasks_reprioritized'
  | 'board:task_updated'
  | 'board:task_moved'
  | 'board:task_deleted'
  | 'board:note_created'
  | 'board:note_updated'
  | 'board:note_deleted'
  | 'board:activity_logged'
  | 'board:presence_updated'
  | 'board:member_joined';

export interface IRealtimePublisher {
  publishToBoard(boardId: string, event: BoardRealtimeEvent, payload: unknown): void;
}
