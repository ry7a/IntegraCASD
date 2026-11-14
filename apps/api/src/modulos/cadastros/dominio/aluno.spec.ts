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

  it('matrícula acima do inteiro do banco (2^31, 1e300) é recusada citando o campo, em vez de virar erro 500', () => {
    expect(lerMatricula(2_147_483_647)).toBe(2_147_483_647);
    for (const grande of [2_147_483_648, 1e300, '2147483648']) {
      expect(() => lerMatricula(grande), String(grande)).toThrow(DadoInvalido);
      expect(() => lerMatricula(grande), String(grande)).toThrow(/matrícula/);
    }
  });

  it('turma no formato T28, sem diferenciar maiúsculas', () => {
    expect(normalizarTurma(' t28 ')).toBe('T28');
    expect(() => normalizarTurma('Turma 28')).toThrow(/T28/);
  });

  // Revisão da spec #57: a spec deixa de fora "limites de negócio mais apertados". E-mail, celular e turma não
  // tinham limite de tamanho; continuam sem (só o teto técnico, bem acima de qualquer valor de verdade).
  it('e-mail, celular e turma sem limite de tamanho de negócio; o caractere nulo continua recusado', () => {
    const emailLongo = `${'a'.repeat(300)}@exemplo.com`;
    expect(normalizarEmail(emailLongo)).toBe(emailLongo);
    // Com a máscara, passa de 20 caracteres, mas os dígitos são 11.
    expect(normalizarCelular('( 1 2 )  9 8 7 6 5 - 4 3 2 1')).toBe('12987654321');
    // Turma longa é recusada pelo formato (T28), não por um tamanho.
    expect(() => normalizarTurma("T28'; DROP TABLE turmas; --")).toThrow(/formato T28/);
    expect(() => normalizarEmail('aluna\u0000@exemplo.com')).toThrow(/nulo\) no e-mail/);
    expect(() => normalizarCelular('12\u000098765-4321')).toThrow(/nulo\) no celular/);
    expect(() => normalizarTurma('T\u000028')).toThrow(/nulo\) na turma/);
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

  it('texto com caractere nulo (colado de outro programa) é recusado citando o campo, em vez de virar erro 500', () => {
    const entrada = { nome: 'Aluna Ficticia', cpf: CPF_VALIDO, email: 'aluna@exemplo.com' };
    expect(() => lerDadosParaInclusao({ ...entrada, nome: 'Aluna\u0000 Ficticia' })).toThrow(/nome/);
    expect(() => lerDadosParaInclusao({ ...entrada, apelido: 'Fic\u0000' })).toThrow(/apelido/);
    expect(() => lerDadosParaAlteracao({ nome: 'Aluna\u0000 Ficticia' })).toThrow(DadoInvalido);
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
