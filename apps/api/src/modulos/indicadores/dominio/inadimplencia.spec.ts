import { apurarInadimplencia, QUANTIDADE_DE_MAIORES_DEVEDORES } from './inadimplencia.js';

const HOJE = '2026-10-26';

// Dados fictícios (LGPD).
const vencida = (alunoId: string, valorCentavos: number, vencimento: string) => ({
  alunoId,
  alunoNome: `Aluno ${alunoId}`,
  valorCentavos,
  vencimento,
});

describe('inadimplência [Indicadores.RF002]', () => {
  it('agrupa por aluno, soma os valores originais e ordena os devedores por valor', () => {
    const resultado = apurarInadimplencia(
      [vencida('a', 8500, '2026-10-10'), vencida('a', 8500, '2026-09-10'), vencida('b', 30000, '2026-10-20')],
      HOJE,
    );
    expect(resultado.alunosInadimplentes).toBe(2);
    expect(resultado.valorEmAbertoCentavos).toBe(47000);
    expect(resultado.maioresDevedores).toEqual([
      { alunoId: 'b', alunoNome: 'Aluno b', quantidade: 1, valorCentavos: 30000, diasDeAtrasoMaisAntigo: 6 },
      { alunoId: 'a', alunoNome: 'Aluno a', quantidade: 2, valorCentavos: 17000, diasDeAtrasoMaisAntigo: 46 },
    ]);
  });

  it('cada aluno entra na faixa do atraso da cobrança mais antiga', () => {
    const resultado = apurarInadimplencia(
      [vencida('a', 100, '2026-10-01'), vencida('b', 100, '2026-09-10'), vencida('b', 100, '2026-10-20'), vencida('c', 100, '2026-08-01')],
      HOJE,
    );
    // a: 25 dias; b: 46 dias (a mais antiga); c: 86 dias.
    expect(resultado.alunosPorFaixa).toEqual({ ate30Dias: 1, de31a60Dias: 1, acimaDe60Dias: 1 });
  });

  it('sem cobranças vencidas, tudo zerado; a relação tem no máximo 10 devedores', () => {
    expect(apurarInadimplencia([], HOJE)).toEqual({
      alunosInadimplentes: 0,
      valorEmAbertoCentavos: 0,
      alunosPorFaixa: { ate30Dias: 0, de31a60Dias: 0, acimaDe60Dias: 0 },
      maioresDevedores: [],
    });
    const muitas = Array.from({ length: 15 }, (_, i) => vencida(`aluno-${i}`, 1000 + i, '2026-10-01'));
    expect(apurarInadimplencia(muitas, HOJE).maioresDevedores).toHaveLength(QUANTIDADE_DE_MAIORES_DEVEDORES);
  });
});
