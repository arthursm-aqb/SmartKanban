import { DefaultEventsMap, Socket } from 'socket.io';
import { z } from 'zod';
import { IRateLimiter } from '../../application/ports/services/IRateLimiter';
import { DomainError, ForbiddenError } from '../../domain/errors';

export interface SocketAuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedSocketData {
  user: SocketAuthUser;
  boardId?: string;
}

export type AuthenticatedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  AuthenticatedSocketData
>;

export type SocketAckResponse<T = unknown> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      message: string;
      fields?: Record<string, string[] | undefined>;
      formErrors?: string[];
      details?: Record<string, unknown>;
      retryAfterSeconds?: number;
    };

export interface SocketHandlerRateLimit {
  scope: 'user' | 'socket';
  maxRequests: number;
  windowMs: number;
}

export interface DefineSocketHandlerOptions<S extends z.ZodType> {
  event: string;
  schema: S;
  requireJoinedBoard?: boolean;
  customRateLimit?: SocketHandlerRateLimit;
  handler: (input: z.output<S>, socket: AuthenticatedSocket) => Promise<unknown>;
}

const GENERAL_MAX_EVENTS_PER_SEC = 30;
const GENERAL_WINDOW_MS = 1000;

export function mapErrorToSocketAck(err: unknown): SocketAckResponse {
  if (err instanceof DomainError) {
    return {
      ok: false,
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    };
  }
  if (process.env.NODE_ENV !== 'test') {
    console.error('[Unhandled WebSocket Error]', err);
  }
  return {
    ok: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Erro interno ao processar evento em tempo real.',
  };
}

/**
 * Unified WebSocket event wrapper enforcing exact execution order:
 * 1. Require ack callback
 * 2. Rate limit (general 30/s per socket + optional per-user event throttling)
 * 3. Zod `.strictObject` payload validation
 * 4. Joined board check (boardId comes from server-verified socket.data, never from payload)
 * 5. Use Case execution (which also re-validates team membership in PostgreSQL)
 */
export function registerSocketHandler<S extends z.ZodType>(
  socket: AuthenticatedSocket,
  rateLimiter: IRateLimiter,
  options: DefineSocketHandlerOptions<S>,
): void {
  const { event, schema, requireJoinedBoard = true, customRateLimit, handler } = options;

  socket.on(event, async (raw: unknown, ack?: (res: SocketAckResponse) => void) => {
    if (typeof ack !== 'function') return;

    const generalLimit = rateLimiter.consume(
      `ws:general:${socket.id}`,
      GENERAL_MAX_EVENTS_PER_SEC,
      GENERAL_WINDOW_MS,
    );
    if (!generalLimit.allowed) {
      ack({
        ok: false,
        error: 'RATE_LIMITED',
        message: 'Muitos eventos enviados em sequência. Reduza a frequência.',
        retryAfterSeconds: generalLimit.retryAfterSeconds,
      });
      return;
    }

    if (customRateLimit) {
      const subject =
        customRateLimit.scope === 'user' ? socket.data.user.id : socket.id;
      const specificLimit = rateLimiter.consume(
        `ws:${event}:${subject}`,
        customRateLimit.maxRequests,
        customRateLimit.windowMs,
      );
      if (!specificLimit.allowed) {
        ack({
          ok: false,
          error: 'RATE_LIMITED',
          message: `Limite temporário atingido para "${event}". Aguarde ${specificLimit.retryAfterSeconds}s.`,
          retryAfterSeconds: specificLimit.retryAfterSeconds,
        });
        return;
      }
    }

    const parsed = schema.safeParse(raw ?? {});
    if (!parsed.success) {
      const flattened = z.flattenError(parsed.error);
      ack({
        ok: false,
        error: 'VALIDATION_ERROR',
        message: 'Payload inválido para o evento.',
        fields: flattened.fieldErrors,
        formErrors: flattened.formErrors,
      });
      return;
    }

    try {
      if (requireJoinedBoard && !socket.data.boardId) {
        throw new ForbiddenError('Conecte-se primeiro a um quadro usando "board:join".');
      }
      const data = await handler(parsed.data, socket);
      ack({ ok: true, data });
    } catch (err) {
      ack(mapErrorToSocketAck(err));
    }
  });
}
