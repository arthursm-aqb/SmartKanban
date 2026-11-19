import { ISessionRepository } from '../../ports/repositories/ISessionRepository';
import { ITokenService } from '../../ports/services/ITokenService';

export class LogoutUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly tokenService: ITokenService,
  ) {}

  public async execute(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;

    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const session = await this.sessionRepository.findByTokenHash(tokenHash);
    if (session) {
      await this.sessionRepository.revokeFamily(session.familyId);
    }
  }
}
