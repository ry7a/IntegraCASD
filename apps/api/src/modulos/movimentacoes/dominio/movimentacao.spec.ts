import { MovimentacaoInvalida, lerFiltros, limitesDoMes, regraDoEstorno } from './movimentacao.js';

const HOJE = '2026-10-26';

describe('consulta de movimentações [Movimentações.RF003]', () => {
  it('sem filtros, mostra o mês corrente com estornos', () => {
    expect(lerFiltros({}, HOJE)).toEqual({
      mes: '2026-10',
      tipo: null,
      categoriaId: null,
      forma: null,
      contratoId: null,
      projetoId: null,
      ocultarEstornos: false,
    });
  });

  it('lê os filtros que chegam da URL, como texto', () => {
    const categoriaId = '11111111-1111-4111-8111-111111111111';
    expect(lerFiltros({ mes: '2026-09', tipo: 'SAIDA', categoriaId, forma: 'PIX', ocultarEstornos: 'true' }, HOJE)).toMatchObject({
      mes: '2026-09',
      tipo: 'SAIDA',
      categoriaId,
      forma: 'PIX',
      ocultarEstornos: true,
    });
  });

  it('recusa mês, tipo, forma ou id inválidos', () => {
    expect(() => lerFiltros({ mes: '2026-13' }, HOJE)).toThrow(MovimentacaoInvalida);
    expect(() => lerFiltros({ tipo: 'OUTRO' }, HOJE)).toThrow(/ENTRADA ou SAIDA/);
    expect(() => lerFiltros({ forma: 'BOLETO' }, HOJE)).toThrow(/forma de pagamento/);
    expect(() => lerFiltros({ projetoId: 'abc' }, HOJE)).toThrow(/projeto/);
  });

  it('o mês vai do dia 1 ao último dia, inclusive fevereiro de ano bissexto', () => {
    expect(limitesDoMes('2026-10')).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' });
    expect(limitesDoMes('2028-02')).toEqual({ inicio: '2028-02-01', fim: '2028-02-29' });
  });
});

describe('quem pode ser estornado [Movimentações.RF002]', () => {
  it('só lançamento manual ainda não estornado', () => {
    expect(regraDoEstorno('MANUAL', false)).toEqual({ podeEstornar: true, motivoSemEstorno: null });
    expect(regraDoEstorno('MANUAL', true)).toMatchObject({ podeEstornar: false, motivoSemEstorno: expect.stringMatching(/já foi estornada/) });
    expect(regraDoEstorno('ESTORNO', false).podeEstornar).toBe(false);
  });

  it('movimentação de cobrança é tratada pela cobrança (fluxo E1)', () => {
    for (const origem of ['CONCILIACAO_AUTOMATICA', 'REGISTRO_MANUAL_DE_COBRANCA'] as const) {
      expect(regraDoEstorno(origem, false)).toMatchObject({ podeEstornar: false, motivoSemEstorno: expect.stringMatching(/trate pela cobrança/) });
    }
  });
});
