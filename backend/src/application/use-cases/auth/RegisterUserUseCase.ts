import { toPublicUser } from '../../../domain/entities/User';
import { ConflictError } from '../../../domain/errors';
import { AuthSessionResult, RegisterUserInput } from '../../dtos/AuthDtos';
import { ISessionRepository } from '../../ports/repositories/ISessionRepository';
import { IUserRepository } from '../../ports/repositories/IUserRepository';
import { IPasswordHasher } from '../../ports/services/IPasswordHasher';
import { ITokenService } from '../../ports/services/ITokenService';

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
  ) {}

  public async execute(input: RegisterUserInput): Promise<AuthSessionResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictError('Já existe uma conta cadastrada com este e-mail.');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.userRepository.create({
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

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
