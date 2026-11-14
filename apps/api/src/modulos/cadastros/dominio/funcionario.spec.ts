import { DadoInvalido } from './comum.js';
import { estaAtivo, lerDadosParaAlteracao, lerDadosParaInclusao, lerSalarioEmCentavos } from './funcionario.js';

// Dados fictícios (LGPD). O CPF só respeita os dígitos verificadores.
const entrada = {
  nome: 'Rosa Ficticia',
  cpf: '390.533.447-05',
  cargo: 'Auxiliar de limpeza',
  salarioReferenciaCentavos: 245000,
  dataAdmissao: '2025-03-01',
};

describe('cadastro de funcionário [Cadastros.RF002]', () => {
  it('na inclusão, normaliza o CPF e aceita sem desligamento', () => {
    expect(lerDadosParaInclusao(entrada)).toEqual({ ...entrada, cpf: '39053344705', dataDesligamento: null });
  });

  it('salário de referência em centavos, inteiro e não negativo', () => {
    expect(lerSalarioEmCentavos(0)).toBe(0);
    expect(() => lerSalarioEmCentavos(2450.5)).toThrow(DadoInvalido);
    expect(() => lerSalarioEmCentavos(-1)).toThrow(DadoInvalido);
  });

  it('recusa data que não existe e desligamento antes da admissão', () => {
    expect(() => lerDadosParaInclusao({ ...entrada, dataAdmissao: '2025-02-30' })).toThrow(/calendário/);
    expect(() => lerDadosParaInclusao({ ...entrada, dataDesligamento: '2025-01-01' })).toThrow(/anterior/);
  });

  it('cargo com caractere nulo é recusado citando o campo, em vez de virar erro 500 no banco', () => {
    expect(() => lerDadosParaInclusao({ ...entrada, cargo: 'Auxiliar\u0000 de limpeza' })).toThrow(/cargo/);
  });

  it('na alteração, confere o período com o que já estava gravado', () => {
    const atual = { dataAdmissao: '2025-03-01', dataDesligamento: null };
    expect(() => lerDadosParaAlteracao({ dataDesligamento: '2024-12-31' }, atual)).toThrow(/anterior/);
    expect(lerDadosParaAlteracao({ dataDesligamento: '' }, atual)).toEqual({ dataDesligamento: null });
  });
});

describe('situação pelo desligamento (fluxo A1)', () => {
  it('fica inativo a partir da data de desligamento, não antes', () => {
    expect(estaAtivo(null, '2026-10-26')).toBe(true);
    expect(estaAtivo('2026-10-31', '2026-10-26')).toBe(true);
    expect(estaAtivo('2026-10-26', '2026-10-26')).toBe(false);
    expect(estaAtivo('2026-09-30', '2026-10-26')).toBe(false);
  });
});
