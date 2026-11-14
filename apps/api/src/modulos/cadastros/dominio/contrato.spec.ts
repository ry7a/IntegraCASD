import { DadoInvalido } from './comum.js';
import { lerDadosParaAlteracao, lerDadosParaInclusao, lerEncerramento, proximoCodigo, situacaoDoContrato } from './contrato.js';

// Dados fictícios.
const valido = {
  contraparte: '  Limpeza   Fictícia Ltda. ',
  objeto: 'Limpeza semanal',
  valorCentavos: 120000,
  periodicidade: 'MENSAL',
  dataInicio: '2026-01-01',
  dataFim: '2026-12-31',
};

describe('contratos [Cadastros.RF004] CT-CAD-03', () => {
  it('lê e normaliza um contrato válido; sem término, o prazo é indeterminado', () => {
    expect(lerDadosParaInclusao(valido)).toEqual({ ...valido, contraparte: 'Limpeza Fictícia Ltda.' });
    expect(lerDadosParaInclusao({ ...valido, dataFim: '' }).dataFim).toBeNull();
  });

  it('recusa término antes do início (fluxo E1), inclusive na alteração', () => {
    expect(() => lerDadosParaInclusao({ ...valido, dataFim: '2025-12-31' })).toThrow(/término não pode ser anterior/);
    expect(() => lerDadosParaAlteracao({ dataInicio: '2027-01-01' }, { dataInicio: '2026-01-01', dataFim: '2026-12-31' })).toThrow(
      DadoInvalido,
    );
    expect(lerDadosParaAlteracao({ dataFim: null }, { dataInicio: '2026-01-01', dataFim: '2026-12-31' })).toEqual({ dataFim: null });
  });

  it('recusa caractere nulo nos textos, citando o campo, em vez de virar erro 500 no banco', () => {
    expect(() => lerDadosParaInclusao({ ...valido, contraparte: 'Limpeza\u0000 Ltda.' })).toThrow(/contraparte/);
    expect(() => lerDadosParaInclusao({ ...valido, objeto: 'Limpeza\u0000' })).toThrow(/objeto/);
    expect(() => lerEncerramento({ dataEncerramento: '2026-10-26', justificativa: 'Mudou\u0000 de fornecedor' }, '2026-01-01')).toThrow(
      /justificativa/,
    );
  });

  it('data com ano antes de 1900 é recusada pela regra comum de data, citando o campo', () => {
    expect(() => lerDadosParaInclusao({ ...valido, dataInicio: '1899-12-31' })).toThrow(/ano da data de início/);
    expect(lerDadosParaInclusao({ ...valido, dataInicio: '1900-01-01' }).dataInicio).toBe('1900-01-01');
  });

  it('recusa periodicidade desconhecida e valor fracionado', () => {
    expect(() => lerDadosParaInclusao({ ...valido, periodicidade: 'SEMANAL' })).toThrow(/periodicidade/);
    expect(() => lerDadosParaInclusao({ ...valido, valorCentavos: 10.5 })).toThrow(/centavos/);
  });

  it('situação: vigente, vence em breve (até 60 dias), encerrado pelo término ou pelo usuário', () => {
    expect(situacaoDoContrato(false, '2026-12-20', '2026-10-26')).toEqual({ situacao: 'VENCE_EM_BREVE', diasParaVencer: 55 });
    expect(situacaoDoContrato(false, '2026-12-31', '2026-10-26')).toEqual({ situacao: 'VIGENTE', diasParaVencer: 66 });
    expect(situacaoDoContrato(false, '2027-06-30', '2026-10-26').situacao).toBe('VIGENTE');
    expect(situacaoDoContrato(false, null, '2026-10-26')).toEqual({ situacao: 'VIGENTE', diasParaVencer: null });
    expect(situacaoDoContrato(false, '2026-10-25', '2026-10-26').situacao).toBe('ENCERRADO');
    expect(situacaoDoContrato(true, '2027-06-30', '2026-10-26').situacao).toBe('ENCERRADO');
  });

  it('encerramento exige justificativa e data a partir do início (fluxo A1)', () => {
    expect(lerEncerramento({ dataEncerramento: '2026-10-26', justificativa: 'Serviço passou para a AEITA' }, '2026-01-01')).toEqual({
      dataEncerramento: '2026-10-26',
      justificativa: 'Serviço passou para a AEITA',
    });
    expect(() => lerEncerramento({ dataEncerramento: '2026-10-26', justificativa: '' }, '2026-01-01')).toThrow(/justificativa/);
    expect(() => lerEncerramento({ dataEncerramento: '2025-10-26', justificativa: 'Antes do início' }, '2026-01-01')).toThrow(/anterior/);
  });

  it('código no formato da planilha: ano + C + sequência (MER, regra 7)', () => {
    expect(proximoCodigo('2026', [])).toBe('26C001');
    expect(proximoCodigo('2026', ['26C001', '26C007', '25C099'])).toBe('26C008');
  });
});
