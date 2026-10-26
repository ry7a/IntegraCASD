import { ParametroInvalido, conferir, lerParametros, proximoCiclo } from './parametros-de-cobranca.js';

const validos = {
  valorMensalidadeCentavos: 8500,
  diaVencimento: 10,
  diaGeracao: 1,
  multaPercentual: 2,
  jurosMensalPercentual: 1,
};

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

describe('próximo ciclo e conferência', () => {
  it('se o dia de geração ainda não passou, é neste mês', () => {
    expect(proximoCiclo('2026-10-01', 1, 10)).toEqual({ geracao: '2026-10-01', vencimento: '2026-10-10' });
  });

  it('se já passou, é no mês seguinte, virando o ano em dezembro', () => {
    expect(proximoCiclo('2026-10-26', 1, 10)).toEqual({ geracao: '2026-11-01', vencimento: '2026-11-10' });
    expect(proximoCiclo('2026-12-05', 1, 10)).toEqual({ geracao: '2027-01-01', vencimento: '2027-01-10' });
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
