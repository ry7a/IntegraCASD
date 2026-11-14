// Regras comuns aos cadastros de pessoas (alunos e funcionários). Só TypeScript puro.
import { MAIOR_ANO, MENOR_ANO, lerDia, lerTexto } from '../../../compartilhado/leitura-de-entrada.js';

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

// Texto livre, lido pela regra comum (compartilhado/leitura-de-entrada.ts): tira espaços das pontas e
// repetidos no meio, recusa o caractere nulo e o que passa de `maximo`. Vazio (ou que não é texto) vira `null`.
// `noCampo` entra na mensagem como está: "no nome", "na justificativa".
export function texto(valor: unknown, noCampo: string, maximo: number): string | null {
  const lido = lerTexto(valor, maximo);
  if (lido.valido) return lido.valor === '' ? null : lido.valor;
  if (lido.motivo === 'caractere-nulo') {
    throw new DadoInvalido(`Há um caractere invisível (nulo) ${noCampo}, comum ao colar de outro programa. Apague e digite de novo.`);
  }
  if (lido.motivo === 'fora-do-limite') throw new DadoInvalido(`Use no máximo ${maximo} caracteres ${noCampo}.`);
  return null;
}

export function normalizarNomeCompleto(valor: unknown): string {
  const nome = texto(valor, 'no nome', 120);
  if (nome === null || nome.length < 3) throw new DadoInvalido('Informe o nome completo.');
  return nome;
}

// Data no formato da API, "AAAA-MM-DD", que existe no calendário (recusa 2026-02-30), pela regra comum.
export function lerData(valor: unknown, campo: string): string {
  const lida = lerDia(valor);
  if (lida.valido) return lida.valor;
  if (lida.motivo === 'inexistente') throw new DadoInvalido(`A ${campo} não existe no calendário. Confira o dia e o mês.`);
  if (lida.motivo === 'fora-do-limite') {
    throw new DadoInvalido(`Confira o ano da ${campo}: ele precisa estar entre ${MENOR_ANO} e ${MAIOR_ANO}.`);
  }
  throw new DadoInvalido(`Informe a ${campo} no formato AAAA-MM-DD.`);
}

// MER, regra 7: código de contrato e projeto no formato da planilha: ano com 2 dígitos + letra
// ("C" ou "P") + sequência de 3 dígitos, continuando a maior sequência do ano.
export function proximoCodigoDoAno(ano: string, letra: 'C' | 'P', codigosDoAno: string[]): string {
  const prefixo = `${ano.slice(2, 4)}${letra}`;
  const maior = codigosDoAno
    .filter((codigo) => codigo.startsWith(prefixo))
    .map((codigo) => Number(codigo.slice(3)))
    .filter((numero) => Number.isInteger(numero))
    .reduce((maximo, numero) => Math.max(maximo, numero), 0);
  return `${prefixo}${String(maior + 1).padStart(3, '0')}`;
}
