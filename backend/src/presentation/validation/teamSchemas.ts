import { z } from 'zod';
import { CreateTeamTextFields, JoinTeamInput } from '../../application/dtos/TeamDtos';

export const createTeamSchema = z.strictObject({
  teamName: z
    .string()
    .trim()
    .min(2, 'O nome da equipe deve ter pelo menos 2 caracteres.')
    .max(60, 'O nome da equipe deve ter no máximo 60 caracteres.'),
  projectName: z
    .string()
    .trim()
    .min(2, 'O nome do projeto deve ter pelo menos 2 caracteres.')
    .max(80, 'O nome do projeto deve ter no máximo 80 caracteres.'),
}) satisfies z.ZodType<CreateTeamTextFields>;

export const joinTeamSchema = z.strictObject({
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8}$/, 'Código de convite inválido. Informe 8 caracteres alfanuméricos.'),
}) satisfies z.ZodType<JoinTeamInput>;
