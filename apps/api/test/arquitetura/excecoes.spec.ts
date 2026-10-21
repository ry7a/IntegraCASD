// G4: exceções explícitas (docs/governanca/excecoes.json).
// Aqui se confere o próprio arquivo: toda exceção precisa de justificativa e referência,
// apontar para uma regra que de fato consulta o arquivo e não repetir outra.
// As exceções obsoletas (que não correspondem mais a nenhuma violação) são detectadas
// por cada teste de regra, em aplicarExcecoes() (veja excecoes.ts).
import { describe, expect, it } from 'vitest';
import { REGRAS_QUE_ACEITAM_EXCECAO, lerExcecoes } from './excecoes.js';

describe('G4: exceções explícitas', () => {
  const excecoes = lerExcecoes();

  it('toda exceção tem regra, alvo, justificativa e referência preenchidos', () => {
    const incompletas = excecoes
      .filter((e) =>
        [e.regra, e.alvo, e.justificativa, e.referencia].some(
          (campo) => typeof campo !== 'string' || campo.trim().length === 0,
        ),
      )
      .map((e) => `${e.regra} ${e.alvo}`);
    expect(incompletas).toEqual([]);
  });

  it('a justificativa explica de verdade (pelo menos 20 caracteres)', () => {
    const curtas = excecoes.filter((e) => e.justificativa.trim().length < 20).map((e) => `${e.regra} ${e.alvo}`);
    expect(curtas).toEqual([]);
  });

  it('toda exceção aponta para uma regra que aceita exceção', () => {
    const invalidas = excecoes.filter((e) => !REGRAS_QUE_ACEITAM_EXCECAO.includes(e.regra)).map((e) => e.regra);
    expect(invalidas).toEqual([]);
  });

  it('não há exceções repetidas', () => {
    const chaves = excecoes.map((e) => `${e.regra}|${e.alvo}`);
    expect(chaves.filter((chave, i) => chaves.indexOf(chave) !== i)).toEqual([]);
  });
});
