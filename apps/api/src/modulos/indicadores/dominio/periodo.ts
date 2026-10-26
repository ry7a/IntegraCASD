// Período de referência dos indicadores [Indicadores.RF001]: um mês "AAAA-MM", o corrente por padrão.

export class PeriodoInvalido extends Error {}

export function lerMes(valor: unknown, hoje: string): string {
  if (valor === undefined || valor === null || valor === '') return hoje.slice(0, 7);
  if (typeof valor !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) {
    throw new PeriodoInvalido('Informe o mês no formato AAAA-MM.');
  }
  return valor;
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
