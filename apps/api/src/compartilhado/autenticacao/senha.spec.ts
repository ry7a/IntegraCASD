import { describe, expect, it } from 'vitest';
import { criarHashDaSenha, senhaConfere } from './senha.js';

describe('protecao das credenciais [Segurança.NF005]', () => {
  it('usa Argon2id com sal aleatorio e nunca armazena a senha em claro', async () => {
    const senha = 'uma-senha-forte-123';
    const primeiro = await criarHashDaSenha(senha);
    const segundo = await criarHashDaSenha(senha);

    expect(primeiro).toMatch(/^argon2id\$v=19\$/);
    expect(primeiro).not.toContain(senha);
    expect(primeiro).not.toBe(segundo);
    await expect(senhaConfere(senha, primeiro)).resolves.toBe(true);
    await expect(senhaConfere('senha-incorreta', primeiro)).resolves.toBe(false);
  });
});
