// Regras da conciliação [Cobranças.RF005]: o que cada aviso do Asaas faz com a cobrança.
// Só TypeScript puro. Datas em "AAAA-MM-DD".
import { dataDoAsaas, dataDoPagamentoNoAsaas } from '../../../compartilhado/asaas/datas-do-pagamento.js';
import { lerCentavos, lerDia, lerTexto, MAIOR_ANO, MENOR_ANO } from '../../../compartilhado/leitura-de-entrada.js';
import { CobrancaInvalida, type SituacaoGuardada } from './cobranca.js';

// O que interessa de um evento de cobrança do Asaas. O corpo completo fica guardado no banco.
// Valor e datas chegam como o Asaas mandou, ainda sem conferir: quem confere é decidirConciliacao,
// que separa "ausente" (nulo: vale o padrão) de "presente e inválido" (vira pendência).
export type AvisoDePagamento = {
  tipo: string;
  // Id da cobrança no Asaas ("pay_..."). Nulo em eventos que não são de cobrança.
  idCobrancaAsaas: string | null;
  // Valor efetivamente pago (com multa e juros, se houve), já em centavos. Nulo quando o Asaas não mandou um número.
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
    // Converte antes de conferir: 0,001 real só se revela inválido depois de virar zero centavo.
    valorPagoCentavos: typeof valor === 'number' ? reaisParaCentavos(valor) : null,
    // As datas são lidas pela mesma função que o cliente do Asaas usa na sincronização
    // (compartilhado/asaas/datas-do-pagamento.ts): para o mesmo dado, webhook e sincronização decidem igual.
    pagoEm: dataDoPagamentoNoAsaas(pagamento),
    disponivelEm: dataDoAsaas(pagamento.creditDate),
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
    // Dado presente e inválido (data fora do calendário, valor que não cabe): nada muda aqui e o aviso
    // vai para conferência, em vez de gravar um dado inventado ou travar a fila.
    const invalido = dadoInvalido(aviso);
    const conferirDadoInvalido = (situacaoAqui: string) =>
      pendencia('DIVERGENCIA', `O Asaas avisou ${descreverTipo(aviso.tipo)}, mas ${invalido}. ${situacaoAqui}`);
    if (cobranca.situacao === 'ABERTA') {
      if (invalido !== null) {
        return conferirDadoInvalido(
          'A cobrança continua aberta: confira o pagamento no painel do Asaas e, se ele foi feito, registre o pagamento manual.',
        );
      }
      // Sem valor pago (ou negativo, que não é valor pago), vale o valor da cobrança.
      const valorPago = aviso.valorPagoCentavos !== null && aviso.valorPagoCentavos > 0 ? aviso.valorPagoCentavos : null;
      return {
        tipo: 'BAIXAR',
        valorPagoCentavos: valorPago ?? cobranca.valorCentavos,
        pagoEm: aviso.pagoEm ?? hoje,
        disponivelEm,
      };
    }
    if (cobranca.situacao === 'PAGA') {
      if (disponivelEm === null || cobranca.disponivelEm !== null) return { tipo: 'NADA' };
      if (invalido !== null) {
        return conferirDadoInvalido('A cobrança continua paga, sem a data em que o valor fica disponível: confira essa data no painel do Asaas.');
      }
      return { tipo: 'MARCAR_DISPONIVEL', disponivelEm };
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

// Dado que o Asaas mandou, mas que não dá para usar (defeitos D4, D5 e D8 do Plano de Testes). Baixar com ele
// gravaria uma data que o Asaas não informou, ou o banco recusaria e o evento ficaria em nova tentativa para
// sempre. Devolve o problema, citando o campo, ou nulo se está tudo certo. Campo ausente não é problema.
function dadoInvalido(aviso: AvisoDePagamento): string | null {
  const datas = [
    ['a data do pagamento', aviso.pagoEm],
    ['a data de crédito', aviso.disponivelEm],
  ] as const;
  for (const [campo, data] of datas) {
    if (data === null) continue;
    const leitura = lerDia(data);
    if (!leitura.valido) {
      // dataDoAsaas já garantiu o formato: sobra a data inexistente (30/02) ou o ano fora do limite.
      return leitura.motivo === 'fora-do-limite'
        ? `${campo} (${data}) está fora dos anos aceitos (${MENOR_ANO} a ${MAIOR_ANO})`
        : `${campo} (${data}) não existe no calendário`;
    }
  }
  // Negativo não é valor pago: conta como "não informado" (vale o da cobrança), como sempre foi.
  const valor = aviso.valorPagoCentavos;
  if (valor !== null && valor >= 0 && !lerCentavos(valor).valido) {
    return valor === 0
      ? 'o valor pago, convertido para centavos, dá zero centavo'
      : 'o valor pago passa do maior valor que o sistema guarda (R$ 21.474.836,47)';
  }
  return null;
}

// Fluxo E1: o texto de quem resolve uma pendência (o que foi conferido e decidido), pela regra comum de
// texto. Sem ela, o caractere nulo chegava ao banco e a resolução dava erro 500.
export function lerResolucaoDaPendencia(valor: unknown): string {
  const lida = lerTexto(valor, 500);
  if (!lida.valido && lida.motivo === 'caractere-nulo') {
    throw new CobrancaInvalida('Há um caractere invisível (nulo) na resolução, comum ao colar de outro programa. Apague e digite de novo.');
  }
  if (!lida.valido && lida.motivo === 'fora-do-limite') throw new CobrancaInvalida('Use no máximo 500 caracteres na resolução.');
  if (!lida.valido || lida.valor.length < 5) {
    throw new CobrancaInvalida('Escreva o que foi conferido e decidido, por exemplo: pagamento em duplicidade devolvido pelo Asaas.');
  }
  return lida.valor;
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
