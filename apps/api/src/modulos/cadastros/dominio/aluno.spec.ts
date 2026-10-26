import {
  DadoInvalido,
  cadastroIncompleto,
  cpfValido,
  lerAlojamento,
  lerDadosParaAlteracao,
  lerDadosParaInclusao,
  lerMatricula,
  normalizarCelular,
  normalizarCpf,
  normalizarEmail,
  normalizarTurma,
} from './aluno.js';

// CPFs fictícios, gerados só com a regra dos dígitos verificadores (LGPD: nenhum CPF real).
const CPF_VALIDO = '52998224725';

describe('CPF [Cadastros.RF001]', () => {
  it('confere os dígitos verificadores', () => {
    expect(cpfValido(CPF_VALIDO)).toBe(true);
    expect(cpfValido('52998224726')).toBe(false);
  });

  it('recusa sequência repetida, que passa na conta mas não existe', () => {
    expect(cpfValido('11111111111')).toBe(false);
  });

  it('aceita com ou sem pontuação e guarda só os dígitos', () => {
    expect(normalizarCpf('529.982.247-25')).toBe(CPF_VALIDO);
  });

  it('explica o que fazer quando o CPF tem tamanho errado ou é inválido', () => {
    expect(() => normalizarCpf('123')).toThrow(/11 números/);
    expect(() => normalizarCpf('52998224726')).toThrow(/não é válido/);
  });
});

describe('demais campos', () => {
  it('e-mail é obrigatório e vai para minúsculas', () => {
    expect(normalizarEmail(' Aluna@Exemplo.COM ')).toBe('aluna@exemplo.com');
    expect(() => normalizarEmail('sem-arroba')).toThrow(DadoInvalido);
  });

  it('celular aceita 10 ou 11 dígitos com DDD', () => {
    expect(normalizarCelular('(12) 98765-4321')).toBe('12987654321');
    expect(normalizarCelular('')).toBeNull();
    expect(() => normalizarCelular('9876-5432')).toThrow(/DDD/);
  });

  it('matrícula é inteiro positivo; vazio vira nulo', () => {
    expect(lerMatricula('2041')).toBe(2041);
    expect(lerMatricula('')).toBeNull();
    expect(() => lerMatricula('-3')).toThrow(DadoInvalido);
  });

  it('turma no formato T28, sem diferenciar maiúsculas', () => {
    expect(normalizarTurma(' t28 ')).toBe('T28');
    expect(() => normalizarTurma('Turma 28')).toThrow(/T28/);
  });

  it('alojamento: os três campos juntos ou nenhum', () => {
    expect(lerAlojamento({ bloco: 'a', apto: '101', vaga: '2' })).toEqual({ bloco: 'A', apto: '101', vaga: '2' });
    expect(lerAlojamento({ bloco: '', apto: ' ', vaga: '' })).toBeNull();
    expect(() => lerAlojamento({ bloco: 'A', apto: '', vaga: '1' })).toThrow(/juntos/);
  });
});

describe('inclusão e alteração', () => {
  it('na inclusão, nome, CPF e e-mail são obrigatórios', () => {
    expect(() => lerDadosParaInclusao({ nome: 'Aluna Ficticia', cpf: CPF_VALIDO })).toThrow(/e-mail/);
    const dados = lerDadosParaInclusao({ nome: 'Aluna Ficticia', cpf: CPF_VALIDO, email: 'aluna@exemplo.com' });
    expect(dados).toMatchObject({ nome: 'Aluna Ficticia', cpf: CPF_VALIDO, turma: null, alojamento: null });
  });

  it('na alteração, só muda o que veio; null limpa campo opcional', () => {
    expect(lerDadosParaAlteracao({ celular: null, turma: 't27' })).toEqual({ celular: null, turma: 'T27' });
  });
});

describe('cadastro incompleto (fluxo A4)', () => {
  it('sem e-mail ou com CPF inválido conta como incompleto', () => {
    expect(cadastroIncompleto({ email: '', cpf: CPF_VALIDO })).toBe(true);
    expect(cadastroIncompleto({ email: 'a@exemplo.com', cpf: '11122233344' })).toBe(true);
    expect(cadastroIncompleto({ email: 'a@exemplo.com', cpf: CPF_VALIDO })).toBe(false);
  });
});
