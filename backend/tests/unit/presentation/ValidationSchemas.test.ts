import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { ColumnType, SubcolumnType } from '../../../src/domain/value-objects/KanbanStage';
import { parseEnv } from '../../../src/main/env';
import { registerSchema } from '../../../src/presentation/validation/authSchemas';
import {
  boardUpdateWipSchema,
  storyMoveSchema,
  taskUpdateSchema,
} from '../../../src/presentation/validation/socketEventSchemas';

describe('Validation Schemas (Zod) & Env', () => {
  it('normaliza e-mail e rejeita senha acima de 72 bytes UTF-8 no cadastro', () => {
    const ok = registerSchema.safeParse({
      name: '  Arthur Silva  ',
      email: '  Arthur@IFRN.EDU.BR  ',
      password: 'PasswordForte123!',
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.email).toBe('arthur@ifrn.edu.br');
      expect(ok.data.name).toBe('Arthur Silva');
    }

    const tooLongAscii = registerSchema.safeParse({
      name: 'Arthur',
      email: 'arthur@ifrn.edu.br',
      password: 'a'.repeat(73),
    });
    expect(tooLongAscii.success).toBe(false);

    // 25 3-byte UTF-8 chars = 75 bytes > 72 bytes even though .length === 25
    const tooLongUtf8 = registerSchema.safeParse({
      name: 'Arthur',
      email: 'arthur@ifrn.edu.br',
      password: '€'.repeat(25),
    });
    expect(tooLongUtf8.success).toBe(false);
  });

  it('rejeita campos extras (anti mass-assignment) como priorityScore dentro de task:update', () => {
    const result = taskUpdateSchema.safeParse({
      taskId: crypto.randomUUID(),
      title: 'Nova descrição',
      priorityScore: 5,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita story:move para SPECIFIED (só permite BACKLOG ou IN_SPECIFICATION)', () => {
    const bad = storyMoveSchema.safeParse({
      storyId: crypto.randomUUID(),
      toSubcolumn: SubcolumnType.SPECIFIED,
      position: 0,
    });
    expect(bad.success).toBe(false);

    const good = storyMoveSchema.safeParse({
      storyId: crypto.randomUUID(),
      toSubcolumn: SubcolumnType.IN_SPECIFICATION,
      position: 0,
    });
    expect(good.success).toBe(true);
  });

  it('valida wipLimit aceitando null e 1..99, mas rejeitando 0', () => {
    expect(
      boardUpdateWipSchema.safeParse({ columnType: ColumnType.SPECIFICATION, wipLimit: 0 }).success,
    ).toBe(false);
    expect(
      boardUpdateWipSchema.safeParse({ columnType: ColumnType.SPECIFICATION, wipLimit: null }).success,
    ).toBe(true);
    expect(
      boardUpdateWipSchema.safeParse({ columnType: ColumnType.SPECIFICATION, wipLimit: 3 }).success,
    ).toBe(true);
  });

  it('valida envSchema com fail-fast para segredos faltantes/iguais e padrão gemini-decision-1', () => {
    const baseEnv = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      FRONTEND_ORIGIN: 'http://localhost:5173',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
    };

    const parsed = parseEnv(baseEnv);
    expect(parsed.GEMINI_MODEL).toBe('gemini-decision-1');
    expect(parsed.GEMINI_API_KEY).toBeUndefined();

    expect(() => parseEnv({ ...baseEnv, JWT_ACCESS_SECRET: undefined })).toThrow();
    expect(() =>
      parseEnv({ ...baseEnv, JWT_REFRESH_SECRET: baseEnv.JWT_ACCESS_SECRET }),
    ).toThrow();
  });
});
