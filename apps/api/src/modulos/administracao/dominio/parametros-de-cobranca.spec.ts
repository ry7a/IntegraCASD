import { ParametroInvalido, conferir, conferirDestino, lerParametros, proximoCiclo } from './parametros-de-cobranca.js';

const validos = {
  valorMensalidadeCentavos: 8500,
  diaVencimento: 10,
  diaGeracao: 1,
  multaPercentual: 2,
  jurosMensalPercentual: 1,
  contaRecebimentoId: null,
  categoriaMensalidadeId: null,
  categoriaAvulsaId: null,
};

const CONTA = '11111111-1111-4111-8111-111111111111';
const CATEGORIA = '22222222-2222-4222-8222-222222222222';

describe('parâmetros de cobrança [Administração.RF003]', () => {
  it('aceita parâmetros válidos', () => {
    expect(lerParametros(validos)).toEqual(validos);
  });

  it('recusa geração no dia do vencimento ou depois (fluxo E1)', () => {
    expect(() => lerParametros({ ...validos, diaGeracao: 10 })).toThrow(/antes do dia de vencimento/);
    expect(() => lerParametros({ ...validos, diaGeracao: 15 })).toThrow(ParametroInvalido);
  });

  it('dias de 1 a 28, para existirem em todo mês', () => {
    expect(() => lerParametros({ ...validos, diaVencimento: 30 })).toThrow(/1 a 28/);
  });

  it('multa até 2% e juros até 1% ao mês', () => {
    expect(() => lerParametros({ ...validos, multaPercentual: 3 })).toThrow(/Código de Defesa do Consumidor/);
    expect(() => lerParametros({ ...validos, jurosMensalPercentual: 2 })).toThrow(/ao mês/);
  });

  it('valor em centavos, inteiro e positivo', () => {
    expect(() => lerParametros({ ...validos, valorMensalidadeCentavos: 85.5 })).toThrow(ParametroInvalido);
    expect(() => lerParametros({ ...validos, valorMensalidadeCentavos: 0 })).toThrow(ParametroInvalido);
  });
});

describe('destino da conciliação [Cobranças.RF005]', () => {
  it('conta e categorias são opcionais; vazio vira nulo', () => {
    expect(lerParametros({ ...validos, contaRecebimentoId: '' })).toMatchObject({ contaRecebimentoId: null });
    expect(lerParametros({ ...validos, contaRecebimentoId: CONTA })).toMatchObject({ contaRecebimentoId: CONTA });
    expect(() => lerParametros({ ...validos, categoriaAvulsaId: 'nao-e-id' })).toThrow(/categoria das cobranças avulsas/);
  });

  it('aceita conta ativa e categorias de entrada ou de ambos os tipos', () => {
    const destino = { contaRecebimentoId: CONTA, categoriaMensalidadeId: CATEGORIA, categoriaAvulsaId: CATEGORIA };
    expect(() =>
      conferirDestino(destino, {
        conta: { id: CONTA, ativo: true },
        categoriaMensalidade: { id: CATEGORIA, ativo: true, tipo: 'ENTRADA' },
        categoriaAvulsa: { id: CATEGORIA, ativo: true, tipo: 'AMBOS' },
      }),
    ).not.toThrow();
  });

  it('recusa conta inativa, categoria inexistente e categoria só de saída', () => {
    const destino = { contaRecebimentoId: CONTA, categoriaMensalidadeId: CATEGORIA, categoriaAvulsaId: null };
    const categoriaBoa = { id: CATEGORIA, ativo: true, tipo: 'ENTRADA' as const };
    expect(() =>
      conferirDestino(destino, { conta: { id: CONTA, ativo: false }, categoriaMensalidade: categoriaBoa, categoriaAvulsa: null }),
    ).toThrow(/conta de recebimento/);
    expect(() =>
      conferirDestino(destino, { conta: { id: CONTA, ativo: true }, categoriaMensalidade: null, categoriaAvulsa: null }),
    ).toThrow(/não foi encontrada/);
    expect(() =>
      conferirDestino(destino, {
        conta: { id: CONTA, ativo: true },
        categoriaMensalidade: { ...categoriaBoa, tipo: 'SAIDA' },
        categoriaAvulsa: null,
      }),
    ).toThrow(/só de saída/);
  });
});

describe('próximo ciclo e conferência', () => {
  it('se o dia de geração ainda não passou, é neste mês', () => {
    expect(proximoCiclo('2026-10-01', 1, 10)).toEqual({ geracao: '2026-10-01', vencimento: '2026-10-10' });
  });

  it('se já passou, é no mês seguinte, virando o ano em dezembro', () => {
    expect(proximoCiclo('2026-10-26', 1, 10)).toEqual({ geracao: '2026-11-01', vencimento: '2026-11-10' });
    expect(proximoCiclo('2026-12-05', 1, 10)).toEqual({ geracao: '2027-01-01', vencimento: '2027-01-10' });
  });

  // Trava GERACAO_A_PARTIR_DE: a rotina não gera mês anterior a ela; a tela anuncia o primeiro liberado.
  it('com a trava, a próxima geração é no primeiro mês liberado, inclusive na virada do ano', () => {
    expect(proximoCiclo('2026-12-05', 1, 10, '2027-02')).toEqual({ geracao: '2027-02-01', vencimento: '2027-02-10' });
    expect(proximoCiclo('2027-01-31', 1, 10, '2027-02')).toEqual({ geracao: '2027-02-01', vencimento: '2027-02-10' });
    // Trava já passada não muda nada.
    expect(proximoCiclo('2027-03-05', 1, 10, '2027-02')).toEqual({ geracao: '2027-04-01', vencimento: '2027-04-10' });
    // Sem trava, ou com trava em formato inválido (em produção nem sobe), vale o cálculo de sempre.
    expect(proximoCiclo('2026-12-05', 1, 10, null)).toEqual({ geracao: '2027-01-01', vencimento: '2027-01-10' });
    expect(proximoCiclo('2026-12-05', 1, 10, '2027-2')).toEqual({ geracao: '2027-01-01', vencimento: '2027-01-10' });
  });

  it('total previsto = alunos cobrados x mensalidade', () => {
    expect(conferir(validos, '2026-10-26', 3)).toEqual({
      proximaGeracao: '2026-11-01',
      proximoVencimento: '2026-11-10',
      alunosCobrados: 3,
      totalPrevistoCentavos: 25500,
    });
  });
});
