import { RefreshSession } from '../../../domain/entities/RefreshSession';

export interface CreateRefreshSessionData {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface ISessionRepository {
  create(data: CreateRefreshSessionData): Promise<RefreshSession>;
  findByTokenHash(tokenHash: string): Promise<RefreshSession | null>;
  revokeSession(sessionId: string, replacedBySessionId?: string | null): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
