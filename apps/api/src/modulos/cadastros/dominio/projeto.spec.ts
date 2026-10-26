import { estaEncerrado, lerDadosParaAlteracao, lerDadosParaInclusao, proximoCodigo } from './projeto.js';

// Dados fictícios.
const valido = { nome: 'Reforma da sala de estudos', dataInicio: '2026-03-01' };

describe('projetos [Cadastros.RF005]', () => {
  it('responsável, término e orçamento são opcionais; a situação começa em "a liberar"', () => {
    expect(lerDadosParaInclusao(valido)).toEqual({
      nome: 'Reforma da sala de estudos',
      responsavel: null,
      dataInicio: '2026-03-01',
      dataFim: null,
      orcamentoPrevistoCentavos: null,
      situacao: 'A_LIBERAR',
    });
    expect(lerDadosParaInclusao({ ...valido, orcamentoPrevistoCentavos: 500000, responsavel: ' Fulano  Fictício ' })).toMatchObject({
      orcamentoPrevistoCentavos: 500000,
      responsavel: 'Fulano Fictício',
    });
  });

  it('recusa término antes do início, orçamento fracionado e situação desconhecida', () => {
    expect(() => lerDadosParaInclusao({ ...valido, dataFim: '2026-01-01' })).toThrow(/término não pode ser anterior/);
    expect(() => lerDadosParaInclusao({ ...valido, orcamentoPrevistoCentavos: 10.5 })).toThrow(/centavos/);
    expect(() => lerDadosParaInclusao({ ...valido, situacao: 'PAUSADO' })).toThrow(/situação/);
  });

  it('encerrar é mudar a situação para executado ou cancelado (fluxo A1)', () => {
    expect(lerDadosParaAlteracao({ situacao: 'EXECUTADO' }, { dataInicio: '2026-03-01', dataFim: null })).toEqual({ situacao: 'EXECUTADO' });
    expect(estaEncerrado('EXECUTADO')).toBe(true);
    expect(estaEncerrado('CANCELADO')).toBe(true);
    expect(['A_LIBERAR', 'LIBERADO', 'EM_EXECUCAO'].map((situacao) => estaEncerrado(situacao as 'A_LIBERAR'))).toEqual([false, false, false]);
  });

  it('código: ano + P + sequência (MER, regra 7)', () => {
    expect(proximoCodigo('2026', ['26C003', '26P002'])).toBe('26P003');
  });
});
