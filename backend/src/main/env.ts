import dotenv from 'dotenv';
import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3333),
    DATABASE_URL: z.url('DATABASE_URL deve ser uma URL válida do PostgreSQL.'),
    FRONTEND_ORIGIN: z.url('FRONTEND_ORIGIN deve ser uma URL válida (ex: http://localhost:5173).'),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET deve ter pelo menos 32 caracteres.'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET deve ter pelo menos 32 caracteres.'),
    GEMINI_API_KEY: z
      .string()
      .transform((val) => (val.trim().length > 0 ? val.trim() : undefined))
      .optional(),
    GEMINI_MODEL: z.string().min(1).default('gemini-decision-1'),
  })
  .refine((data) => data.JWT_ACCESS_SECRET !== data.JWT_REFRESH_SECRET, {
    message: 'JWT_ACCESS_SECRET e JWT_REFRESH_SECRET precisam ser diferentes.',
    path: ['JWT_REFRESH_SECRET'],
  });

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): AppEnv {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Configuração de ambiente inválida:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function loadEnv(): AppEnv {
  dotenv.config();
  try {
    return parseEnv(process.env);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
