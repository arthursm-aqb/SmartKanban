import { PublicUser, toPublicUser } from '../../../domain/entities/User';
import { UnauthorizedError } from '../../../domain/errors';
import { IUserRepository } from '../../ports/repositories/IUserRepository';

export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  public async execute(userId: string): Promise<PublicUser> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError('Usuário autenticado não encontrado.');
    }
    return toPublicUser(user);
  }
}
