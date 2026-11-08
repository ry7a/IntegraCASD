// Regras dos parâmetros das cobranças recorrentes [Administração.RF003]. Só TypeScript puro.
// Datas no formato "AAAA-MM-DD".
import { mesNoFormatoAAAAMM } from '../../../compartilhado/datas.js';

export type ParametrosDeCobranca = {
  valorMensalidadeCentavos: number;
  diaVencimento: number;
  diaGeracao: number;
  // Percentuais inteiros (2 = 2%). Quem calcula multa e juros é o Asaas, no pagamento.
  multaPercentual: number;
  jurosMensalPercentual: number;
} & DestinoDaConciliacao;

// Onde entra o pagamento conciliado [Cobranças.RF005] passo 6. Nulo = ainda não escolhido: a
// conciliação espera, porque não há como criar a movimentação de entrada sem conta e categoria.
export type DestinoDaConciliacao = {
  contaRecebimentoId: string | null;
  categoriaMensalidadeId: string | null;
  categoriaAvulsaId: string | null;
};

export class ParametroInvalido extends Error {}

// Limites legais para cobrança de consumidor: multa até 2% (CDC, art. 52, § 1º) e juros de
// mora até 1% ao mês.
export const MULTA_MAXIMA_PERCENTUAL = 2;
export const JUROS_MAXIMO_PERCENTUAL_AO_MES = 1;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idOpcional(valor: unknown, mensagem: string): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string' || !UUID.test(valor)) throw new ParametroInvalido(mensagem);
  return valor;
}

function inteiroEntre(valor: unknown, minimo: number, maximo: number, mensagem: string): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new ParametroInvalido(mensagem);
  }
  return valor;
}

export function lerParametros(entrada: Partial<Record<keyof ParametrosDeCobranca, unknown>>): ParametrosDeCobranca {
  const parametros: ParametrosDeCobranca = {
    valorMensalidadeCentavos: inteiroEntre(
      entrada.valorMensalidadeCentavos,
      1,
      Number.MAX_SAFE_INTEGER,
      'Informe o valor da mensalidade em centavos, como número inteiro maior que zero (ex.: 8500 para R$ 85,00).',
    ),
    // Até 28: todo mês tem esse dia, inclusive fevereiro.
    diaVencimento: inteiroEntre(entrada.diaVencimento, 1, 28, 'O dia de vencimento deve ser de 1 a 28.'),
    diaGeracao: inteiroEntre(entrada.diaGeracao, 1, 28, 'O dia de geração deve ser de 1 a 28.'),
    multaPercentual: inteiroEntre(
      entrada.multaPercentual,
      0,
      MULTA_MAXIMA_PERCENTUAL,
      `A multa por atraso deve ser de 0% a ${MULTA_MAXIMA_PERCENTUAL}% (limite do Código de Defesa do Consumidor).`,
    ),
    jurosMensalPercentual: inteiroEntre(
      entrada.jurosMensalPercentual,
      0,
      JUROS_MAXIMO_PERCENTUAL_AO_MES,
      `Os juros devem ser de 0% a ${JUROS_MAXIMO_PERCENTUAL_AO_MES}% ao mês.`,
    ),
    contaRecebimentoId: idOpcional(entrada.contaRecebimentoId, 'Escolha a conta de recebimento na lista.'),
    categoriaMensalidadeId: idOpcional(entrada.categoriaMensalidadeId, 'Escolha a categoria das mensalidades na lista.'),
    categoriaAvulsaId: idOpcional(entrada.categoriaAvulsaId, 'Escolha a categoria das cobranças avulsas na lista.'),
  };
  // Fluxo E1: gerar depois do vencimento produziria cobranças já vencidas na emissão.
  if (parametros.diaGeracao >= parametros.diaVencimento) {
    throw new ParametroInvalido('O dia de geração precisa ser antes do dia de vencimento.');
  }
  return parametros;
}

function dia(ano: number, mes: number, diaDoMes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(diaDoMes).padStart(2, '0')}`;
}

// A próxima geração é no dia de geração deste mês, se ainda não passou; senão, no do mês seguinte.
// O vencimento é no mesmo mês da geração (a geração vem sempre antes do vencimento).
// `aPartirDe` é a trava GERACAO_A_PARTIR_DE ("AAAA-MM"): a geração recorrente não gera mês anterior a ela
// (regra em cobrancas/dominio/geracao-recorrente.ts), então a tela anuncia o primeiro mês liberado.
// Trava em formato inválido é ignorada aqui: em produção ela nem deixa o sistema subir (configuracao.ts).
export function proximoCiclo(
  hoje: string,
  diaGeracao: number,
  diaVencimento: number,
  aPartirDe: string | null = null,
): { geracao: string; vencimento: string } {
  let ano = Number(hoje.slice(0, 4));
  let mes = Number(hoje.slice(5, 7));
  if (Number(hoje.slice(8, 10)) > diaGeracao) {
    mes += 1;
    if (mes === 13) {
      mes = 1;
      ano += 1;
    }
  }
  // "AAAA-MM" com zeros à esquerda se compara como texto: "2026-12" < "2027-02".
  if (aPartirDe !== null && mesNoFormatoAAAAMM(aPartirDe) && dia(ano, mes, 1).slice(0, 7) < aPartirDe) {
    ano = Number(aPartirDe.slice(0, 4));
    mes = Number(aPartirDe.slice(5, 7));
  }
  return { geracao: dia(ano, mes, diaGeracao), vencimento: dia(ano, mes, diaVencimento) };
}

export type Conferencia = {
  proximaGeracao: string;
  proximoVencimento: string;
  alunosCobrados: number;
  totalPrevistoCentavos: number;
};

// O que o usuário confere antes de salvar (fluxo principal, passo 4).
export function conferir(
  parametros: ParametrosDeCobranca,
  hoje: string,
  alunosCobraveis: number,
  aPartirDe: string | null = null,
): Conferencia {
  const ciclo = proximoCiclo(hoje, parametros.diaGeracao, parametros.diaVencimento, aPartirDe);
  return {
    proximaGeracao: ciclo.geracao,
    proximoVencimento: ciclo.vencimento,
    alunosCobrados: alunosCobraveis,
    totalPrevistoCentavos: alunosCobraveis * parametros.valorMensalidadeCentavos,
  };
}

export type OpcaoDeDestino = { id: string; ativo: boolean; tipo?: 'ENTRADA' | 'SAIDA' | 'AMBOS' };

// Confere o destino escolhido contra o que existe no banco: conta ativa e categorias ativas que
// aceitam entrada (uma mensalidade paga é entrada de dinheiro).
export function conferirDestino(
  destino: DestinoDaConciliacao,
  encontrados: { conta: OpcaoDeDestino | null; categoriaMensalidade: OpcaoDeDestino | null; categoriaAvulsa: OpcaoDeDestino | null },
): void {
  if (destino.contaRecebimentoId !== null && (encontrados.conta === null || !encontrados.conta.ativo)) {
    throw new ParametroInvalido('A conta de recebimento não foi encontrada ou está inativa. Escolha outra na lista.');
  }
  const categorias = [
    { id: destino.categoriaMensalidadeId, encontrada: encontrados.categoriaMensalidade, nome: 'das mensalidades' },
    { id: destino.categoriaAvulsaId, encontrada: encontrados.categoriaAvulsa, nome: 'das cobranças avulsas' },
  ];
  for (const { id, encontrada, nome } of categorias) {
    if (id === null) continue;
    if (encontrada === null || !encontrada.ativo) {
      throw new ParametroInvalido(`A categoria ${nome} não foi encontrada ou está inativa. Escolha outra na lista.`);
    }
    if (encontrada.tipo === 'SAIDA') {
      throw new ParametroInvalido(`A categoria ${nome} é só de saída. Escolha uma categoria de entrada.`);
    }
  }
}
