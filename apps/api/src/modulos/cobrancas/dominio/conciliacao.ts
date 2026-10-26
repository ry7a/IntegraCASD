// Regras da conciliação [Cobranças.RF005]: o que cada aviso do Asaas faz com a cobrança.
// Só TypeScript puro. Datas em "AAAA-MM-DD".
import type { SituacaoGuardada } from './cobranca.js';

// O que interessa de um evento de cobrança do Asaas. O corpo completo fica guardado no banco.
export type AvisoDePagamento = {
  tipo: string;
  // Id da cobrança no Asaas ("pay_..."). Nulo em eventos que não são de cobrança.
  idCobrancaAsaas: string | null;
  // Valor efetivamente pago (com multa e juros, se houve). Nulo quando o Asaas não informou.
  valorPagoCentavos: number | null;
  pagoEm: string | null;
  // Fluxo A1: quando o valor fica disponível na conta do Asaas.
  disponivelEm: string | null;
};

// O Asaas manda reais com casas decimais (ex.: 85.5). Arredonda para o centavo: o valor nunca
// circula como fração daqui em diante.
export function reaisParaCentavos(reais: number): number {
  return Math.round(reais * 100);
}

function dia(valor: unknown): string | null {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor) ? valor.slice(0, 10) : null;
}

export function lerAvisoDePagamento(tipo: string, payload: unknown): AvisoDePagamento {
  const corpo = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
  const pagamento =
    typeof corpo.payment === 'object' && corpo.payment !== null ? (corpo.payment as Record<string, unknown>) : null;
  if (pagamento === null || typeof pagamento.id !== 'string') {
    return { tipo, idCobrancaAsaas: null, valorPagoCentavos: null, pagoEm: null, disponivelEm: null };
  }
  const valor = pagamento.value;
  return {
    tipo,
    idCobrancaAsaas: pagamento.id,
    valorPagoCentavos: typeof valor === 'number' && valor > 0 ? reaisParaCentavos(valor) : null,
    pagoEm: dia(pagamento.paymentDate) ?? dia(pagamento.clientPaymentDate) ?? dia(pagamento.confirmedDate),
    disponivelEm: dia(pagamento.creditDate),
  };
}

export type CobrancaAConciliar = {
  situacao: SituacaoGuardada;
  valorCentavos: number;
  disponivelEm: string | null;
};

export type AcaoDaConciliacao =
  // O evento não muda nada aqui (ex.: cobrança criada, vencida, atualizada).
  | { tipo: 'NADA' }
  // Passos 5 e 6: paga e cria a movimentação de entrada, na mesma transação.
  | { tipo: 'BAIXAR'; valorPagoCentavos: number; pagoEm: string; disponivelEm: string | null }
  // Fluxo A1: o valor de uma cobrança já paga ficou disponível.
  | { tipo: 'MARCAR_DISPONIVEL'; disponivelEm: string }
  // Passo 5: estorno leva a "Estornada"; a entrada é anulada por uma movimentação de estorno.
  | { tipo: 'ESTORNAR' }
  // Cobrança removida no painel do Asaas: deixa de valer aqui também.
  | { tipo: 'CANCELAR' }
  // Fluxo E1 e [Cobranças.RF006] fluxo E2: vai para a fila de pendências, para conferência humana.
  | { tipo: 'PENDENCIA'; tipoDaPendencia: TipoDePendencia; motivo: string; idCobrancaAsaas: string };

// Os tipos da fila de pendências de conciliação.
export type TipoDePendencia = 'SEM_COBRANCA' | 'APOS_REGISTRO_MANUAL' | 'DIVERGENCIA';

const PAGAMENTO = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);
const ESTORNO = new Set(['PAYMENT_REFUNDED']);
const REMOCAO = new Set(['PAYMENT_DELETED']);
// Eventos que pedem conferência se a cobrança existe (contestação de cartão, restauração no painel).
const A_CONFERIR = new Set(['PAYMENT_RESTORED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE']);

const SITUACOES_PAGAS: SituacaoGuardada[] = ['PAGA', 'PAGA_COM_REGISTRO_MANUAL'];

// Decide o que fazer com o aviso. `cobranca` é nula quando não há cobrança com aquele id no Asaas.
// `hoje` entra por parâmetro para o teste.
export function decidirConciliacao(aviso: AvisoDePagamento, cobranca: CobrancaAConciliar | null, hoje: string): AcaoDaConciliacao {
  const relevante = PAGAMENTO.has(aviso.tipo) || ESTORNO.has(aviso.tipo) || REMOCAO.has(aviso.tipo) || A_CONFERIR.has(aviso.tipo);
  const idCobrancaAsaas = aviso.idCobrancaAsaas;
  if (!relevante || idCobrancaAsaas === null) return { tipo: 'NADA' };
  const pendencia = (tipoDaPendencia: TipoDePendencia, motivo: string): AcaoDaConciliacao => ({
    tipo: 'PENDENCIA',
    tipoDaPendencia,
    motivo,
    idCobrancaAsaas,
  });

  if (cobranca === null) {
    // Cobrança apagada que nunca existiu aqui não pede nada; dinheiro sem cobrança, sim (fluxo E1).
    if (REMOCAO.has(aviso.tipo)) return { tipo: 'NADA' };
    return pendencia(
      'SEM_COBRANCA',
      `O Asaas avisou ${descreverTipo(aviso.tipo)} de uma cobrança que não existe aqui (${idCobrancaAsaas}). Sincronize com o Asaas para trazê-la.`,
    );
  }

  if (PAGAMENTO.has(aviso.tipo)) {
    const disponivelEm = aviso.tipo === 'PAYMENT_RECEIVED' ? (aviso.disponivelEm ?? aviso.pagoEm ?? hoje) : null;
    if (cobranca.situacao === 'ABERTA') {
      return {
        tipo: 'BAIXAR',
        valorPagoCentavos: aviso.valorPagoCentavos ?? cobranca.valorCentavos,
        pagoEm: aviso.pagoEm ?? hoje,
        disponivelEm,
      };
    }
    if (cobranca.situacao === 'PAGA') {
      return disponivelEm !== null && cobranca.disponivelEm === null ? { tipo: 'MARCAR_DISPONIVEL', disponivelEm } : { tipo: 'NADA' };
    }
    if (cobranca.situacao === 'PAGA_COM_REGISTRO_MANUAL') {
      // [Cobranças.RF006] fluxo E2: não cria segunda entrada; pode ser pagamento em duplicidade.
      return pendencia(
        'APOS_REGISTRO_MANUAL',
        'O Asaas confirmou o pagamento de uma cobrança já registrada manualmente. Confira se o aluno pagou duas vezes.',
      );
    }
    // Estornada só fica a cobrança que o Asaas pagou antes: este é um aviso antigo chegando atrasado.
    if (cobranca.situacao === 'ESTORNADA') return { tipo: 'NADA' };
    return pendencia('DIVERGENCIA', 'O Asaas confirmou o pagamento de uma cobrança cancelada. Confira com o aluno e com o Asaas.');
  }

  if (ESTORNO.has(aviso.tipo)) {
    if (cobranca.situacao === 'PAGA') return { tipo: 'ESTORNAR' };
    if (cobranca.situacao === 'ESTORNADA') return { tipo: 'NADA' };
    return pendencia('DIVERGENCIA', 'O Asaas avisou o estorno de uma cobrança que não estava paga por ele. Confira a situação no Asaas.');
  }

  if (REMOCAO.has(aviso.tipo)) {
    if (cobranca.situacao === 'ABERTA') return { tipo: 'CANCELAR' };
    if (cobranca.situacao === 'CANCELADA') return { tipo: 'NADA' };
    return pendencia('DIVERGENCIA', 'O Asaas removeu uma cobrança que está paga aqui. Confira a situação no Asaas.');
  }

  // A_CONFERIR: só pede atenção se a cobrança estava paga ou cancelada.
  if (SITUACOES_PAGAS.includes(cobranca.situacao) || cobranca.situacao === 'CANCELADA') {
    return pendencia('DIVERGENCIA', `O Asaas avisou ${descreverTipo(aviso.tipo)}. Confira a cobrança no Asaas.`);
  }
  return { tipo: 'NADA' };
}

function descreverTipo(tipo: string): string {
  const descricoes: Record<string, string> = {
    PAYMENT_CONFIRMED: 'o pagamento',
    PAYMENT_RECEIVED: 'o recebimento',
    PAYMENT_REFUNDED: 'o estorno',
    PAYMENT_RESTORED: 'a restauração de uma cobrança removida',
    PAYMENT_CHARGEBACK_REQUESTED: 'uma contestação do pagamento no cartão',
    PAYMENT_CHARGEBACK_DISPUTE: 'uma disputa de contestação no cartão',
  };
  return descricoes[tipo] ?? `o evento ${tipo}`;
}
