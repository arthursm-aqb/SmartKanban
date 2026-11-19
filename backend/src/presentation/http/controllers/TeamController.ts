import { Request, Response } from 'express';
import { CreateTeamTextFields, JoinTeamInput } from '../../../application/dtos/TeamDtos';
import { CreateTeamWithProjectUseCase } from '../../../application/use-cases/teams/CreateTeamWithProjectUseCase';
import { JoinTeamByInviteUseCase } from '../../../application/use-cases/teams/JoinTeamByInviteUseCase';
import { ListUserTeamsUseCase } from '../../../application/use-cases/teams/ListUserTeamsUseCase';
import { DomainValidationError, UnauthorizedError } from '../../../domain/errors';

export class TeamController {
  constructor(
    private readonly createTeamWithProjectUseCase: CreateTeamWithProjectUseCase,
    private readonly joinTeamByInviteUseCase: JoinTeamByInviteUseCase,
    private readonly listUserTeamsUseCase: ListUserTeamsUseCase,
  ) {}

  public list = async (req: Request, res: Response): Promise<void> => {
    if (!req.authUser) throw new UnauthorizedError();
    const teams = await this.listUserTeamsUseCase.execute(req.authUser.id);
    res.status(200).json({ teams });
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    if (!req.authUser) throw new UnauthorizedError();
    const file = req.file;
    if (!file) {
      throw new DomainValidationError('Arquivo de visão geral (.pdf, .md ou .txt) é obrigatório.');
    }

    const fields = req.body as CreateTeamTextFields;
    const created = await this.createTeamWithProjectUseCase.execute({
      userId: req.authUser.id,
      teamName: fields.teamName,
      projectName: fields.projectName,
      document: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
      },
    });

    res.status(201).json(created);
  };

  public join = async (req: Request, res: Response): Promise<void> => {
    if (!req.authUser) throw new UnauthorizedError();
    const body = req.body as JoinTeamInput;

    const result = await this.joinTeamByInviteUseCase.execute({
      userId: req.authUser.id,
      inviteCode: body.inviteCode,
    });

    res.status(200).json(result);
  };
}
