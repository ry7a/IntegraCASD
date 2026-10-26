import { randomBytes } from 'node:crypto';
import { ChaveDeCifragemAusente, chaveMestraDoAmbiente, cifrar, decifrar } from './cifra.js';

describe('cifra da chave do Asaas [Segurança.NF003]', () => {
  const chaveMestra = randomBytes(32);
  // Texto qualquer no lugar da chave: um prefixo real de chave do Asaas aqui seria barrado pela B11.
  const segredo = 'chave-ficticia-de-teste-123';

  it('o texto guardado não contém o segredo e volta igual ao decifrar', () => {
    const guardado = cifrar(segredo, chaveMestra);
    expect(guardado).not.toContain('chave-ficticia');
    expect(decifrar(guardado, chaveMestra)).toBe(segredo);
  });

  it('cifrar duas vezes dá textos diferentes (vetor de inicialização aleatório)', () => {
    expect(cifrar(segredo, chaveMestra)).not.toBe(cifrar(segredo, chaveMestra));
  });

  it('outra chave-mestra ou texto adulterado não decifram', () => {
    const guardado = cifrar(segredo, chaveMestra);
    expect(() => decifrar(guardado, randomBytes(32))).toThrow();
    const adulterado = Buffer.from(guardado, 'base64');
    adulterado[adulterado.length - 1] ^= 1;
    expect(() => decifrar(adulterado.toString('base64'), chaveMestra)).toThrow();
  });

  it('a chave-mestra do .env precisa ter 32 bytes', () => {
    expect(() => chaveMestraDoAmbiente({})).toThrow(ChaveDeCifragemAusente);
    expect(chaveMestraDoAmbiente({ CHAVE_DE_CIFRAGEM: randomBytes(32).toString('base64') })).toHaveLength(32);
  });
});
