// Regras da sincronização com o Asaas [Cobranças.RF007]. Só TypeScript puro. Datas em "AAAA-MM-DD".
// A sincronização não tem regras próprias de baixa: transforma a situação que o Asaas informa no mesmo
// aviso que o webhook mandaria, e a conciliação (conciliacao.ts) decide o efeito.
import { dataDoAsaas } from '../../../compartilhado/asaas/datas-do-pagamento.js';
import { CobrancaInvalida, diasEntre, type SituacaoExibida } from './cobranca.js';
import type { AvisoDePagamento } from './conciliacao.js';

// O que a sincronização precisa saber de uma cobrança no Asaas.
export type SituacaoNoAsaas = {
  idAsaas: string;
  situacao: string;
  removida: boolean;
  valorCentavos: number;
  pagoEm: string | null;
  disponivelEm: string | null;
};

// Situação no Asaas -> evento equivalente do webhook.
const EVENTO_DA_SITUACAO: Record<string, string> = {
  CONFIRMED: 'PAYMENT_CONFIRMED',
  RECEIVED: 'PAYMENT_RECEIVED',
  // Marcada como recebida em dinheiro no painel do Asaas.
  RECEIVED_IN_CASH: 'PAYMENT_RECEIVED',
  REFUNDED: 'PAYMENT_REFUNDED',
};

export function avisoDaSituacaoNoAsaas(cobranca: SituacaoNoAsaas): AvisoDePagamento {
  const tipo = cobranca.removida ? 'PAYMENT_DELETED' : (EVENTO_DA_SITUACAO[cobranca.situacao] ?? `SITUACAO_${cobranca.situacao}`);
  return {
    tipo,
    idCobrancaAsaas: cobranca.idAsaas,
    // Vai como veio: quem confere (zero centavo, acima do limite) é a conciliação, igual para o webhook.
    valorPagoCentavos: cobranca.valorCentavos,
    // O cliente do Asaas já leu as datas como o webhook as lê (compartilhado/asaas/datas-do-pagamento.ts);
    // ler de novo não muda nada e protege de outra implementação do ClienteAsaas.
    pagoEm: dataDoAsaas(cobranca.pagoEm),
    // O Asaas só informa a data de crédito quando o valor já foi recebido.
    disponivelEm: cobranca.situacao === 'RECEIVED' || cobranca.situacao === 'RECEIVED_IN_CASH' ? dataDoAsaas(cobranca.disponivelEm) : null,
  };
}

// Referência externa gravada pela geração recorrente: "mensalidade:<alunoId>:<AAAA-MM>".
// Permite reconhecer uma mensalidade criada no Asaas e não gravada aqui ([Cobranças.RF001] fluxo E2).
export function lerReferenciaDeMensalidade(referenciaExterna: string | null): { alunoId: string; referencia: string } | null {
  const partes = /^mensalidade:([0-9a-f-]{36}):(\d{4}-\d{2})$/i.exec(referenciaExterna ?? '');
  return partes === null ? null : { alunoId: partes[1], referencia: partes[2] };
}

// Multa e juros de uma cobrança criada no painel do Asaas: os limites legais valem aqui também
// (multa até 2%, juros até 1% ao mês, em percentuais inteiros).
export function encargosDentroDosLimites(multa: number, juros: number): { multaPercentual: number; jurosMensalPercentual: number } {
  const limitar = (valor: number, maximo: number) => Math.min(maximo, Math.max(0, Math.round(valor)));
  return { multaPercentual: limitar(multa, 2), jurosMensalPercentual: limitar(juros, 1) };
}

// Período de vencimentos a sincronizar. Até um ano, para a consulta ao Asaas não ficar enorme.
export const DIAS_MAXIMOS_DO_PERIODO = 366;

export function lerPeriodo(entrada: { vencimentoDe?: unknown; vencimentoAte?: unknown }): { vencimentoDe: string; vencimentoAte: string } {
  const dia = /^\d{4}-\d{2}-\d{2}$/;
  const { vencimentoDe, vencimentoAte } = entrada;
  if (typeof vencimentoDe !== 'string' || !dia.test(vencimentoDe) || typeof vencimentoAte !== 'string' || !dia.test(vencimentoAte)) {
    throw new CobrancaInvalida('Informe o período de vencimento: as duas datas, no formato AAAA-MM-DD.');
  }
  if (vencimentoDe > vencimentoAte) throw new CobrancaInvalida('A data inicial do período precisa ser antes da final.');
  if (diasEntre(vencimentoDe, vencimentoAte) > DIAS_MAXIMOS_DO_PERIODO) {
    throw new CobrancaInvalida('Sincronize no máximo um ano de vencimentos por vez.');
  }
  return { vencimentoDe, vencimentoAte };
}

// Rotina diária (fluxo A2): dos vencidos nos últimos 90 dias aos que vencem nos próximos 31.
export function periodoDaRotinaDiaria(hoje: string): { vencimentoDe: string; vencimentoAte: string } {
  const deslocar = (dias: number) => {
    const data = new Date(`${hoje}T00:00:00Z`);
    data.setUTCDate(data.getUTCDate() + dias);
    return data.toISOString().slice(0, 10);
  };
  return { vencimentoDe: deslocar(-90), vencimentoAte: deslocar(31) };
}

// [Cobranças.RF008] fluxo A2 e [Indicadores.RF001]: vencida cuja última sincronização tem mais de sete
// dias é sinalizada. Sem sincronização, conta desde o vencimento.
export const DIAS_PARA_SINCRONIZACAO_ANTIGA = 7;

export function semSincronizarHaDias(situacao: SituacaoExibida, vencimento: string, sincronizadaEm: string | null, hoje: string): number | null {
  if (situacao !== 'VENCIDA') return null;
  const dias = diasEntre(sincronizadaEm ?? vencimento, hoje);
  return dias > DIAS_PARA_SINCRONIZACAO_ANTIGA ? dias : null;
}

// Detalhe da cobrança ([Cobranças.RF006] passo 2): recomenda sincronizar antes de registrar pagamento
// manual quando a última consulta não é de hoje.
export function sincronizacaoAntiga(sincronizadaEm: string | null, hoje: string): boolean {
  return sincronizadaEm === null || diasEntre(sincronizadaEm, hoje) >= 1;
}
