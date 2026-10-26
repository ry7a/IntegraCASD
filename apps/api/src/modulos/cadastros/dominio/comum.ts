// Regras comuns aos cadastros de pessoas (alunos e funcionários). Só TypeScript puro.

// Erros do domínio; a camada de aplicação traduz para 400 (dado inválido) ou 409 (duplicado).
export class DadoInvalido extends Error {}
export class CadastroDuplicado extends Error {}

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
    throw new DadoInvalido('O CPF precisa ter 11 números, por exemplo 000.000.000-00.');
  }
  if (!cpfValido(digitos)) {
    throw new DadoInvalido('Este CPF não é válido. Confira os números com o documento.');
  }
  return digitos;
}

// Texto livre: tira espaços das pontas e repetidos no meio. Vazio vira `null`.
export function texto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpo = valor.trim().replace(/\s+/g, ' ');
  return limpo === '' ? null : limpo;
}

export function normalizarNomeCompleto(valor: unknown): string {
  const nome = texto(valor);
  if (nome === null || nome.length < 3) throw new DadoInvalido('Informe o nome completo.');
  if (nome.length > 120) throw new DadoInvalido('Use no máximo 120 caracteres no nome.');
  return nome;
}

// Data no formato da API, "AAAA-MM-DD", e que existe no calendário (recusa 2026-02-30).
export function lerData(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new DadoInvalido(`Informe a ${campo} no formato AAAA-MM-DD.`);
  }
  const data = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) {
    throw new DadoInvalido(`A ${campo} não existe no calendário. Confira o dia e o mês.`);
  }
  return valor;
}
