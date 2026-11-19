import { z } from 'zod';
import { LoginUserInput, RegisterUserInput } from '../../application/dtos/AuthDtos';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('E-mail inválido.'));

const newPasswordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .refine(
    (password) => Buffer.byteLength(password, 'utf8') <= 72,
    'A senha ultrapassa 72 bytes (limite do bcrypt).',
  );

export const registerSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(2, 'O nome deve ter pelo menos 2 caracteres.')
    .max(80, 'O nome deve ter no máximo 80 caracteres.'),
  email: emailSchema,
  password: newPasswordSchema,
}) satisfies z.ZodType<RegisterUserInput>;

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Informe a senha.')
    .max(200, 'Senha acima do tamanho permitido.'),
}) satisfies z.ZodType<LoginUserInput>;
