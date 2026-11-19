import { ListUserTeamsOutput } from '../../dtos/TeamDtos';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';

export class ListUserTeamsUseCase {
  constructor(private readonly teamRepository: ITeamRepository) {}

  public async execute(userId: string): Promise<ListUserTeamsOutput> {
    return this.teamRepository.listUserTeams(userId);
  }
}
