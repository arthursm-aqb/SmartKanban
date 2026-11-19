import { ActivityActionType, ActivityEntityType } from '../../../domain/entities/ActivityLog';
import { DomainValidationError } from '../../../domain/errors';
import { InviteCode } from '../../../domain/value-objects/InviteCode';
import { CreateTeamWithProjectInput, CreateTeamWithProjectOutput } from '../../dtos/TeamDtos';
import { ITeamRepository } from '../../ports/repositories/ITeamRepository';
import { IDocumentParserRegistry } from '../../ports/services/IDocumentParser';
import { IInviteCodeGenerator } from '../../ports/services/IInviteCodeGenerator';
import { RecordActivityLogUseCase } from '../activity/RecordActivityLogUseCase';

export class CreateTeamWithProjectUseCase {
  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly documentParserRegistry: IDocumentParserRegistry,
    private readonly inviteCodeGenerator: IInviteCodeGenerator,
    private readonly recordActivityLog: RecordActivityLogUseCase,
  ) {}

  public async execute(input: CreateTeamWithProjectInput): Promise<CreateTeamWithProjectOutput> {
    const parsedDoc = await this.documentParserRegistry.parse(input.document);
    if (parsedDoc.text.trim().length < 10) {
      throw new DomainValidationError(
        'O documento de visão geral precisa conter texto legível (mínimo de 10 caracteres).',
      );
    }

    const inviteCode = InviteCode.create(this.inviteCodeGenerator.generate()).value;

    const created = await this.teamRepository.createTeamWithProjectAndBoard({
      teamName: input.teamName.trim(),
      inviteCode,
      createdById: input.userId,
      projectName: input.projectName.trim(),
      contextFileName: parsedDoc.fileName,
      contextFileType: parsedDoc.fileType,
      contextText: parsedDoc.text,
    });

    await this.recordActivityLog.execute({
      boardId: created.boardId,
      actorId: input.userId,
      actionType: ActivityActionType.TEAM_CREATED,
      entityType: ActivityEntityType.TEAM,
      entityId: created.team.id,
      summary: `Criou a equipe "${created.team.name}" e o projeto "${input.projectName.trim()}" com o documento "${parsedDoc.fileName}".`,
      metadata: {
        contextFileName: parsedDoc.fileName,
        contextFileType: parsedDoc.fileType,
      },
    });

    return {
      team: created.team,
      projectId: created.projectId,
      boardId: created.boardId,
      contextFileName: parsedDoc.fileName,
    };
  }
}
