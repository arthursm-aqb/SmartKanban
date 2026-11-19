import { toPublicUser } from '../../../domain/entities/User';
import { UnauthorizedError } from '../../../domain/errors';
import { AuthSessionResult, LoginUserInput } from '../../dtos/AuthDtos';
import { ISessionRepository } from '../../ports/repositories/ISessionRepository';
import { IUserRepository } from '../../ports/repositories/IUserRepository';
import { IPasswordHasher } from '../../ports/services/IPasswordHasher';
import { ITokenService } from '../../ports/services/ITokenService';

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
  ) {}

  public async execute(input: LoginUserInput): Promise<AuthSessionResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedError('E-mail ou senha inválidos.');
    }

    const passwordMatches = await this.passwordHasher.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('E-mail ou senha inválidos.');
    }

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });
    const refresh = this.tokenService.generateRefreshToken(user.id);

    await this.sessionRepository.create({
      userId: user.id,
      familyId: refresh.familyId,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
    });

    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken: refresh.rawToken,
      refreshExpiresAt: refresh.expiresAt,
    };
  }
}
