import { describe, expect, it } from 'vitest';
import { ConflictError, UnauthorizedError } from '../../../src/domain/errors';
import { createTestContainer } from '../../doubles/InMemoryContainer';

describe('Auth Use Cases (JWT + Refresh Rotation + Reuse Detection + Logout)', () => {
  it('registra usuário, rejeita e-mail duplicado e autentica no login', async () => {
    const { container } = createTestContainer();

    const registered = await container.useCases.registerUser.execute({
      name: 'Alice Dev',
      email: 'alice@ifrn.edu.br',
      password: 'SenhaSegura123!',
    });

    expect(registered.user.email).toBe('alice@ifrn.edu.br');
    expect(registered.accessToken).toBeTruthy();
    expect(registered.refreshToken).toBeTruthy();

    await expect(
      container.useCases.registerUser.execute({
        name: 'Alice Clone',
        email: 'ALICE@ifrn.edu.br',
        password: 'OutraSenha123!',
      }),
    ).rejects.toThrow(ConflictError);

    const loggedIn = await container.useCases.loginUser.execute({
      email: 'alice@ifrn.edu.br',
      password: 'SenhaSegura123!',
    });
    expect(loggedIn.user.id).toBe(registered.user.id);

    await expect(
      container.useCases.loginUser.execute({
        email: 'alice@ifrn.edu.br',
        password: 'SenhaErrada!',
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('rotaciona Refresh Token e revoga toda a família ao detectar reuso suspeito', async () => {
    const { container } = createTestContainer();

    const initial = await container.useCases.registerUser.execute({
      name: 'Bob Dev',
      email: 'bob@ifrn.edu.br',
      password: 'SenhaSegura123!',
    });

    // Normal rotation: R1 -> R2
    const rotated = await container.useCases.refreshSession.execute(initial.refreshToken);
    expect(rotated.refreshToken).not.toBe(initial.refreshToken);

    // Attacker replays already-rotated R1 -> triggers Reuse Detection and revokes family (including R2)!
    await expect(
      container.useCases.refreshSession.execute(initial.refreshToken),
    ).rejects.toThrow(UnauthorizedError);

    // Now even the legitimate R2 is revoked!
    await expect(
      container.useCases.refreshSession.execute(rotated.refreshToken),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('revoga a sessão no banco ao executar logout', async () => {
    const { container } = createTestContainer();

    const initial = await container.useCases.registerUser.execute({
      name: 'Carol Dev',
      email: 'carol@ifrn.edu.br',
      password: 'SenhaSegura123!',
    });

    await container.useCases.logout.execute(initial.refreshToken);

    await expect(
      container.useCases.refreshSession.execute(initial.refreshToken),
    ).rejects.toThrow(UnauthorizedError);
  });
});
