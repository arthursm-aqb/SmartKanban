export interface RefreshSession {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBySessionId: string | null;
  createdAt: Date;
}

export function isSessionExpired(session: RefreshSession, now: Date = new Date()): boolean {
  return session.expiresAt.getTime() <= now.getTime();
}

export function isSessionRevoked(session: RefreshSession): boolean {
  return session.revokedAt !== null;
}
