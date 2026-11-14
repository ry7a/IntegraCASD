// Regras das movimentações [Movimentações.RF001 a RF003]. Só TypeScript puro. Datas em "AAAA-MM-DD".
import {
  lerCentavos,
  lerDia,
  lerMes,
  lerTexto,
  mensagemDoDia,
  mensagemDoMes,
  mensagemDoTexto,
  mensagemDosCentavos,
} from '../../../compartilhado/leitura-de-entrada.js';

export type TipoMovimentacao = 'ENTRADA' | 'SAIDA';
export type FormaPagamento = 'ASAAS' | 'PIX' | 'TRANSFERENCIA' | 'DINHEIRO' | 'CARTAO';
export type OrigemMovimentacao = 'MANUAL' | 'CONCILIACAO_AUTOMATICA' | 'REGISTRO_MANUAL_DE_COBRANCA' | 'ESTORNO';

export class MovimentacaoInvalida extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS: TipoMovimentacao[] = ['ENTRADA', 'SAIDA'];
const FORMAS: FormaPagamento[] = ['ASAAS', 'PIX', 'TRANSFERENCIA', 'DINHEIRO', 'CARTAO'];

// ---------------------------------------------------------------------------
// Consulta [Movimentações.RF003]
// ---------------------------------------------------------------------------

export type FiltrosDeMovimentacoes = {
  // Mês das movimentações, "AAAA-MM". Por padrão, o corrente (passo 2).
  mes: string;
  tipo: TipoMovimentacao | null;
  categoriaId: string | null;
  forma: FormaPagamento | null;
  contratoId: string | null;
  projetoId: string | null;
  // Fluxo A1: esconde as estornadas e os seus espelhos (os totais não mudam: o par se anula).
  ocultarEstornos: boolean;
};

function idOpcional(valor: unknown, mensagem: string): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string' || !UUID.test(valor)) throw new MovimentacaoInvalida(mensagem);
  return valor;
}

function deUmaLista<T extends string>(valor: unknown, lista: T[], mensagem: string): T | null {
  if (valor === undefined || valor === null || valor === '') return null;
  const encontrado = lista.find((item) => item === valor);
  if (encontrado === undefined) throw new MovimentacaoInvalida(mensagem);
  return encontrado;
}

// Mês da consulta pela regra comum: mês de 01 a 12 e ano de 1900 a 9999 ("0000-01" passava no formato
// e estourava no banco). A mensagem da recusa também vem da regra comum.
function lerMesDaConsulta(valor: unknown): string {
  const lido = lerMes(valor);
  if (lido.valido) return lido.valor;
  throw new MovimentacaoInvalida(mensagemDoMes(lido.motivo, 'o mês'));
}

// `hoje` entra por parâmetro para o teste. Os valores chegam da URL, como texto.
export function lerFiltros(consulta: Record<string, unknown>, hoje: string): FiltrosDeMovimentacoes {
  const mes = lerMesDaConsulta(consulta.mes === undefined || consulta.mes === '' ? hoje.slice(0, 7) : consulta.mes);
  return {
    mes,
    tipo: deUmaLista(consulta.tipo, TIPOS, 'O tipo deve ser ENTRADA ou SAIDA.'),
    categoriaId: idOpcional(consulta.categoriaId, 'Escolha a categoria na lista.'),
    forma: deUmaLista(consulta.forma, FORMAS, 'Escolha a forma de pagamento na lista.'),
    contratoId: idOpcional(consulta.contratoId, 'Escolha o contrato na lista.'),
    projetoId: idOpcional(consulta.projetoId, 'Escolha o projeto na lista.'),
    ocultarEstornos: consulta.ocultarEstornos === 'true' || consulta.ocultarEstornos === true,
  };
}

// Primeiro e último dia do mês "AAAA-MM".
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, numero] = mes.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimoDia).padStart(2, '0')}` };
}

// ---------------------------------------------------------------------------
// Estorno [Movimentações.RF002]
// ---------------------------------------------------------------------------

// Quem pode ser estornado e, se não puder, por quê (a tela mostra o motivo no botão desabilitado).
export function regraDoEstorno(
  origem: OrigemMovimentacao,
  jaEstornada: boolean,
): { podeEstornar: boolean; motivoSemEstorno: string | null } {
  if (jaEstornada) return { podeEstornar: false, motivoSemEstorno: 'Esta movimentação já foi estornada.' };
  if (origem === 'ESTORNO') return { podeEstornar: false, motivoSemEstorno: 'Um estorno não é estornado: lance a movimentação correta.' };
  if (origem === 'CONCILIACAO_AUTOMATICA' || origem === 'REGISTRO_MANUAL_DE_COBRANCA') {
    // Fluxo E1: espelho do que ocorreu no Asaas; estornar aqui faria o sistema divergir da plataforma.
    return {
      podeEstornar: false,
      motivoSemEstorno: 'Movimentação de cobrança: trate pela cobrança. Uma devolução ao aluno é feita no Asaas e chega pela conciliação.',
    };
  }
  return { podeEstornar: true, motivoSemEstorno: null };
}

// Motivo pela regra comum de texto: sem ela, o caractere nulo chegava ao banco e o estorno dava erro 500.
export function lerMotivoDoEstorno(valor: unknown): string {
  const lido = lerTexto(valor, 300);
  // O que não é texto conta como motivo em branco (a mensagem abaixo pede o motivo).
  if (!lido.valido && lido.motivo !== 'formato') throw new MovimentacaoInvalida(mensagemDoTexto(lido.motivo, 'o motivo', 300));
  if (!lido.valido || lido.valor.length < 5) {
    throw new MovimentacaoInvalida('Informe o motivo do estorno, por exemplo: valor lançado errado.');
  }
  return lido.valor;
}

// ---------------------------------------------------------------------------
// Registro [Movimentações.RF001]
// ---------------------------------------------------------------------------

// Forma de pagamento de lançamento manual: Asaas só entra pela conciliação de cobranças.
export type FormaManual = Exclude<FormaPagamento, 'ASAAS'>;
const FORMAS_MANUAIS: FormaManual[] = ['PIX', 'TRANSFERENCIA', 'DINHEIRO', 'CARTAO'];

export type NovaMovimentacao = {
  contaId: string;
  tipo: TipoMovimentacao;
  valorCentavos: number;
  data: string;
  categoriaId: string;
  forma: FormaManual;
  descricao: string;
  // No máximo um vínculo (CHECK no banco também).
  contratoId: string | null;
  projetoId: string | null;
  funcionarioId: string | null;
};

// A data é lida pela regra comum (compartilhado/leitura-de-entrada.ts), que recusa 30/02 e mês 13
// em vez de deixar o banco trocar por outra data, e monta a mensagem da recusa.
function lerDataDoLancamento(valor: unknown): string {
  const lida = lerDia(valor);
  if (lida.valido) return lida.valor;
  throw new MovimentacaoInvalida(mensagemDoDia(lida.motivo, 'a data'));
}

// Valor em centavos pela regra comum. Fluxo E2: valor zero (ou negativo, ou fracionado, ou em texto) é
// recusado, e o que passa do que a coluna guarda também.
function lerValorDoLancamento(valor: unknown): number {
  const lido = lerCentavos(valor);
  if (lido.valido) return lido.valor;
  throw new MovimentacaoInvalida(mensagemDosCentavos(lido.motivo, 'o valor'));
}

// Descrição pela regra comum: aparada, espaços repetidos reduzidos e sem caractere nulo (o PostgreSQL
// recusa o \u0000, que costuma vir de colar de outro programa). Texto curto demais ou que não é texto
// pede a descrição de novo.
function lerDescricaoDoLancamento(valor: unknown): string {
  const lida = lerTexto(valor, 200);
  if (!lida.valido && lida.motivo !== 'formato') throw new MovimentacaoInvalida(mensagemDoTexto(lida.motivo, 'a descrição', 200));
  if (!lida.valido || lida.valor.length < 3) {
    throw new MovimentacaoInvalida('Descreva a movimentação, por exemplo: NF 685, limpeza de outubro.');
  }
  return lida.valor;
}

// `hoje` entra por parâmetro para o teste.
export function lerNovaMovimentacao(entrada: Partial<Record<keyof NovaMovimentacao, unknown>>, hoje: string): NovaMovimentacao {
  const contaId = idOpcional(entrada.contaId, 'Escolha a conta na lista.');
  if (contaId === null) throw new MovimentacaoInvalida('Escolha a conta da movimentação.');
  const tipo = deUmaLista(entrada.tipo, TIPOS, 'Escolha se é entrada ou saída.');
  if (tipo === null) throw new MovimentacaoInvalida('Escolha se é entrada ou saída.');
  const valor = lerValorDoLancamento(entrada.valorCentavos);
  const data = lerDataDoLancamento(entrada.data);
  // Fluxo E1: movimentação registra fato ocorrido, não previsão.
  if (data > hoje) throw new MovimentacaoInvalida('A data não pode ser no futuro: registre a movimentação quando ela acontecer.');
  const categoriaId = idOpcional(entrada.categoriaId, 'Escolha a categoria na lista.');
  if (categoriaId === null) throw new MovimentacaoInvalida('Escolha a categoria da movimentação.');
  const forma = deUmaLista(entrada.forma, FORMAS_MANUAIS, 'Escolha a forma: Pix, transferência, dinheiro ou cartão.');
  if (forma === null) throw new MovimentacaoInvalida('Escolha a forma: Pix, transferência, dinheiro ou cartão.');
  const descricao = lerDescricaoDoLancamento(entrada.descricao);
  const contratoId = idOpcional(entrada.contratoId, 'Escolha o contrato na lista.');
  const projetoId = idOpcional(entrada.projetoId, 'Escolha o projeto na lista.');
  const funcionarioId = idOpcional(entrada.funcionarioId, 'Escolha o funcionário na lista.');
  if ([contratoId, projetoId, funcionarioId].filter((id) => id !== null).length > 1) {
    throw new MovimentacaoInvalida('Vincule a movimentação a um só cadastro: contrato, projeto ou funcionário.');
  }
  return { contaId, tipo, valorCentavos: valor, data, categoriaId, forma, descricao, contratoId, projetoId, funcionarioId };
}

// MER, regra 2: entrada não recebe categoria só de saída, e vice-versa.
export function conferirCategoria(tipo: TipoMovimentacao, categoria: { ativo: boolean; tipo: 'ENTRADA' | 'SAIDA' | 'AMBOS' } | null): void {
  if (categoria === null || !categoria.ativo) {
    throw new MovimentacaoInvalida('A categoria não foi encontrada ou está inativa. Escolha outra na lista.');
  }
  if (categoria.tipo !== 'AMBOS' && categoria.tipo !== tipo) {
    const deQue = (valor: string) => (valor === 'ENTRADA' ? 'entrada' : 'saída');
    throw new MovimentacaoInvalida(`Esta categoria é só de ${deQue(categoria.tipo)}. Escolha uma categoria de ${deQue(tipo)}.`);
  }
}
