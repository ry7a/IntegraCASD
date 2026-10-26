// Regras do cadastro de aluno [Cadastros.RF001]. Só TypeScript puro: sem framework e sem banco.

export const CURSOS = ['AER', 'ELE', 'MEC', 'CIV', 'COMP', 'AESP'] as const;
export type Curso = (typeof CURSOS)[number];

export const POSTOS = ['CIVIL', 'ALUNO_MILITAR', 'ASP_OF'] as const;
export type Posto = (typeof POSTOS)[number];

export type Alojamento = { bloco: string; apto: string; vaga: string };

// Os dados do aluno já validados. Campo opcional sem valor fica `null`.
export type DadosDoAluno = {
  nome: string;
  cpf: string;
  email: string;
  celular: string | null;
  apelido: string | null;
  matricula: number | null;
  turma: string | null;
  curso: Curso | null;
  posto: Posto | null;
  alojamento: Alojamento | null;
};

// Erros do domínio; a camada de aplicação traduz para 400 ou 409.
export class DadoDoAlunoInvalido extends Error {}
export class CadastroDuplicado extends Error {}

// ---------------------------------------------------------------------------
// CPF
// ---------------------------------------------------------------------------

// Confere os dois dígitos verificadores. Sequências repetidas (111.111.111-11) passam na conta,
// mas não existem: são recusadas. O Asaas também recusa CPF inválido.
export function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  const numeros = digitos.split('').map(Number);
  const digito = (quantidade: number) => {
    let soma = 0;
    for (let i = 0; i < quantidade; i++) soma += numeros[i] * (quantidade + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === numeros[9] && digito(10) === numeros[10];
}

// Aceita com ou sem pontuação ("123.456.789-09" ou "12345678909") e devolve só os dígitos.
export function normalizarCpf(valor: unknown): string {
  const digitos = typeof valor === 'string' ? valor.replace(/\D/g, '') : '';
  if (digitos.length !== 11) {
    throw new DadoDoAlunoInvalido('O CPF precisa ter 11 números, por exemplo 000.000.000-00.');
  }
  if (!cpfValido(digitos)) {
    throw new DadoDoAlunoInvalido('Este CPF não é válido. Confira os números com o documento do aluno.');
  }
  return digitos;
}

// ---------------------------------------------------------------------------
// Demais campos
// ---------------------------------------------------------------------------

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim().replace(/\s+/g, ' ');
  return limpo === '' ? null : limpo;
}

export function normalizarNome(valor: unknown): string {
  const nome = texto(valor);
  if (nome === null || nome.length < 3) throw new DadoDoAlunoInvalido('Informe o nome completo do aluno.');
  if (nome.length > 120) throw new DadoDoAlunoInvalido('Use no máximo 120 caracteres no nome.');
  return nome;
}

export function normalizarEmail(valor: unknown): string {
  const email = texto(valor)?.toLowerCase() ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DadoDoAlunoInvalido('Informe um e-mail válido, por exemplo nome@exemplo.com. O Asaas exige o e-mail.');
  }
  return email;
}

// Celular com DDD: 10 ou 11 dígitos. Guarda só os dígitos.
export function normalizarCelular(valor: unknown): string | null {
  const bruto = texto(valor);
  if (bruto === null) return null;
  const digitos = bruto.replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 11) {
    throw new DadoDoAlunoInvalido('Informe o celular com DDD, por exemplo (12) 90000-0000.');
  }
  return digitos;
}

export function normalizarApelido(valor: unknown): string | null {
  const apelido = texto(valor);
  if (apelido !== null && apelido.length > 40) throw new DadoDoAlunoInvalido('Use no máximo 40 caracteres no apelido.');
  return apelido;
}

export function lerMatricula(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = typeof valor === 'string' ? Number(valor.trim()) : valor;
  if (typeof numero !== 'number' || !Number.isInteger(numero) || numero <= 0) {
    throw new DadoDoAlunoInvalido('A matrícula deve ser um número inteiro positivo.');
  }
  return numero;
}

// Turma no formato da planilha: "T" seguido de dois dígitos (T26, T28...).
export function normalizarTurma(valor: unknown): string | null {
  const turma = texto(valor)?.toUpperCase().replace(/\s/g, '') ?? null;
  if (turma === null) return null;
  if (!/^T\d{2}$/.test(turma)) throw new DadoDoAlunoInvalido('Informe a turma no formato T28.');
  return turma;
}

function lerDaLista<T extends string>(lista: readonly T[], valor: unknown, mensagem: string): T | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const encontrado = lista.find((permitido) => permitido === valor);
  if (encontrado === undefined) throw new DadoDoAlunoInvalido(mensagem);
  return encontrado;
}

export function lerCurso(valor: unknown): Curso | null {
  return lerDaLista(CURSOS, valor, `O curso deve ser um destes: ${CURSOS.join(', ')}.`);
}

export function lerPosto(valor: unknown): Posto | null {
  return lerDaLista(POSTOS, valor, 'O posto deve ser civil, aluno militar ou aspirante a oficial.');
}

// Alojamento é uma vaga: bloco, apartamento e vaga juntos, ou nenhum dos três.
export function lerAlojamento(valor: unknown): Alojamento | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'object' || Array.isArray(valor)) {
    throw new DadoDoAlunoInvalido('Informe o alojamento com bloco, apartamento e vaga.');
  }
  const campos = valor as Record<string, unknown>;
  const bloco = texto(campos.bloco)?.toUpperCase() ?? null;
  const apto = texto(campos.apto)?.toUpperCase() ?? null;
  const vaga = texto(campos.vaga)?.toUpperCase() ?? null;
  if (bloco === null && apto === null && vaga === null) return null;
  if (bloco === null || apto === null || vaga === null) {
    throw new DadoDoAlunoInvalido('Informe bloco, apartamento e vaga juntos, ou deixe os três em branco.');
  }
  if ([bloco, apto, vaga].some((parte) => parte.length > 10)) {
    throw new DadoDoAlunoInvalido('Bloco, apartamento e vaga têm no máximo 10 caracteres cada.');
  }
  return { bloco, apto, vaga };
}

// ---------------------------------------------------------------------------
// Entrada completa (inclusão) e parcial (alteração)
// ---------------------------------------------------------------------------

export type EntradaDoAluno = Partial<Record<keyof DadosDoAluno, unknown>>;

const LEITORES: { [Campo in keyof DadosDoAluno]: (valor: unknown) => DadosDoAluno[Campo] } = {
  nome: normalizarNome,
  cpf: normalizarCpf,
  email: normalizarEmail,
  celular: normalizarCelular,
  apelido: normalizarApelido,
  matricula: lerMatricula,
  turma: normalizarTurma,
  curso: lerCurso,
  posto: lerPosto,
  alojamento: lerAlojamento,
};

export function lerDadosParaInclusao(entrada: EntradaDoAluno): DadosDoAluno {
  return {
    nome: LEITORES.nome(entrada.nome),
    cpf: LEITORES.cpf(entrada.cpf),
    email: LEITORES.email(entrada.email),
    celular: LEITORES.celular(entrada.celular),
    apelido: LEITORES.apelido(entrada.apelido),
    matricula: LEITORES.matricula(entrada.matricula),
    turma: LEITORES.turma(entrada.turma),
    curso: LEITORES.curso(entrada.curso),
    posto: LEITORES.posto(entrada.posto),
    alojamento: LEITORES.alojamento(entrada.alojamento),
  };
}

// Na alteração, campo ausente (undefined) não muda; `null` limpa um campo opcional.
export function lerDadosParaAlteracao(entrada: EntradaDoAluno): Partial<DadosDoAluno> {
  const dados: Partial<DadosDoAluno> = {};
  for (const campo of Object.keys(LEITORES) as Array<keyof DadosDoAluno>) {
    if (entrada[campo] !== undefined) {
      // O TypeScript não consegue ligar cada campo ao seu leitor dentro do laço; o tipo de LEITORES garante isso.
      (dados as Record<string, unknown>)[campo] = LEITORES[campo](entrada[campo]);
    }
  }
  return dados;
}

// Cadastro incompleto (fluxo A4): vindo da carga inicial sem e-mail ou com CPF inválido. Não
// recebe cobrança até ser corrigido, porque o Asaas exige os dois.
export function cadastroIncompleto(aluno: { email: string; cpf: string }): boolean {
  return aluno.email.trim() === '' || !cpfValido(aluno.cpf);
}
