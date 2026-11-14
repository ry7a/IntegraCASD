// Período de referência dos indicadores [Indicadores.RF001]: um mês "AAAA-MM", o corrente por padrão.
import { MAIOR_ANO, MENOR_ANO, lerMes as lerMesComum } from '../../../compartilhado/leitura-de-entrada.js';

export class PeriodoInvalido extends Error {}

// O mês é lido pela regra comum (compartilhado/leitura-de-entrada.ts), a mesma das movimentações: mês de
// 01 a 12 e ano de 1900 a 9999. "0000-01" passava no formato e o banco dava erro 500.
export function lerMes(valor: unknown, hoje: string): string {
  if (valor === undefined || valor === null || valor === '') return hoje.slice(0, 7);
  const lido = lerMesComum(valor);
  if (lido.valido) return lido.valor;
  if (lido.motivo === 'inexistente') throw new PeriodoInvalido('O mês vai de 01 a 12. Informe o mês no formato AAAA-MM.');
  if (lido.motivo === 'abaixo-do-minimo' || lido.motivo === 'acima-do-maximo') {
    throw new PeriodoInvalido(`Confira o ano do mês: ele precisa estar entre ${MENOR_ANO} e ${MAIOR_ANO}.`);
  }
  throw new PeriodoInvalido('Informe o mês no formato AAAA-MM.');
}

// somarMeses("2026-01", -1) -> "2025-12"
export function somarMeses(mes: string, quantidade: number): string {
  const [ano, numero] = mes.split('-').map(Number);
  const total = ano * 12 + (numero - 1) + quantidade;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

// Primeiro e último dia do mês.
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, numero] = mes.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimoDia).padStart(2, '0')}` };
}

// Parte de um total, em %, com uma casa decimal (32.0 = 32,0%). Contas com inteiros: centavos nunca
// viram fração (regra B5). Total zero dá zero.
export function percentual(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte * 1000) / total) / 10;
}

// Variação % de um valor sobre o anterior, com uma casa decimal; nulo se não havia base.
export function variacao(atual: number, anterior: number): number | null {
  return anterior === 0 ? null : Math.round(((atual - anterior) * 1000) / anterior) / 10;
}
