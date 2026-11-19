import { isSessionExpired, isSessionRevoked } from '../../../domain/entities/RefreshSession';
import { toPublicUser } from '../../../domain/entities/User';
import { UnauthorizedError } from '../../../domain/errors';
import { AuthSessionResult } from '../../dtos/AuthDtos';
import { ISessionRepository } from '../../ports/repositories/ISessionRepository';
import { IUserRepository } from '../../ports/repositories/IUserRepository';
import { ITokenService } from '../../ports/services/ITokenService';

export class RefreshSessionUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly tokenService: ITokenService,
  ) {}

  public async execute(rawRefreshToken: string): Promise<AuthSessionResult> {
    let payload;
    try {
      payload = this.tokenService.verifyRefreshToken(rawRefreshToken);
    } catch {
      throw new UnauthorizedError('Refresh token inválido ou expirado.');
    }

    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const existingSession = await this.sessionRepository.findByTokenHash(tokenHash);

    if (!existingSession) {
      // Token had valid signature but is not known in DB -> revoke family defensively.
      await this.sessionRepository.revokeFamily(payload.familyId);
      throw new UnauthorizedError('Sessão inválida. Faça login novamente.');
    }

    if (isSessionRevoked(existingSession)) {
      // Refresh Token Reuse Detection: an already rotated/revoked token was replayed!
      await this.sessionRepository.revokeFamily(existingSession.familyId);
      throw new UnauthorizedError('Reuso suspeito de sessão detectado. Faça login novamente.');
    }

    if (isSessionExpired(existingSession)) {
      await this.sessionRepository.revokeSession(existingSession.id, null);
      throw new UnauthorizedError('Sessão expirada. Faça login novamente.');
    }

    const user = await this.userRepository.findById(existingSession.userId);
    if (!user) {
      await this.sessionRepository.revokeFamily(existingSession.familyId);
      throw new UnauthorizedError('Usuário da sessão não encontrado.');
    }

    const nextRefresh = this.tokenService.generateRefreshToken(user.id, existingSession.familyId);
    const createdSession = await this.sessionRepository.create({
      userId: user.id,
      familyId: nextRefresh.familyId,
      tokenHash: nextRefresh.tokenHash,
      expiresAt: nextRefresh.expiresAt,
    });

    await this.sessionRepository.revokeSession(existingSession.id, createdSession.id);

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken: nextRefresh.rawToken,
      refreshExpiresAt: nextRefresh.expiresAt,
    };
  }
}
