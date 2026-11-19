import { PrismaClient } from '@prisma/client';
import {
  CreateRefreshSessionData,
  ISessionRepository,
} from '../../../application/ports/repositories/ISessionRepository';
import { RefreshSession } from '../../../domain/entities/RefreshSession';

export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: CreateRefreshSessionData): Promise<RefreshSession> {
    return this.prisma.refreshSession.create({
      data: {
        userId: data.userId,
        familyId: data.familyId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  }

  public async findByTokenHash(tokenHash: string): Promise<RefreshSession | null> {
    return this.prisma.refreshSession.findUnique({ where: { tokenHash } });
  }

  public async revokeSession(sessionId: string, replacedBySessionId?: string | null): Promise<void> {
    await this.prisma.refreshSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        replacedBySessionId: replacedBySessionId ?? null,
      },
    });
  }

  public async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  public async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
