// Regras das movimentações [Movimentações.RF001 a RF003]. Só TypeScript puro. Datas em "AAAA-MM-DD".

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

// `hoje` entra por parâmetro para o teste. Os valores chegam da URL, como texto.
export function lerFiltros(consulta: Record<string, unknown>, hoje: string): FiltrosDeMovimentacoes {
  const mes = consulta.mes === undefined || consulta.mes === '' ? hoje.slice(0, 7) : consulta.mes;
  if (typeof mes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    throw new MovimentacaoInvalida('Informe o mês no formato AAAA-MM.');
  }
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

// `hoje` entra por parâmetro para o teste.
export function lerNovaMovimentacao(entrada: Partial<Record<keyof NovaMovimentacao, unknown>>, hoje: string): NovaMovimentacao {
  const contaId = idOpcional(entrada.contaId, 'Escolha a conta na lista.');
  if (contaId === null) throw new MovimentacaoInvalida('Escolha a conta da movimentação.');
  const tipo = deUmaLista(entrada.tipo, TIPOS, 'Escolha se é entrada ou saída.');
  if (tipo === null) throw new MovimentacaoInvalida('Escolha se é entrada ou saída.');
  const valor = entrada.valorCentavos;
  // Fluxo E2: valor zero (ou negativo, ou fracionado) é recusado.
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
    throw new MovimentacaoInvalida('Informe um valor maior que zero, em centavos inteiros (ex.: 120000 para R$ 1.200,00).');
  }
  const data = entrada.data;
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new MovimentacaoInvalida('Informe a data no formato AAAA-MM-DD.');
  }
  // Fluxo E1: movimentação registra fato ocorrido, não previsão.
  if (data > hoje) throw new MovimentacaoInvalida('A data não pode ser no futuro: registre a movimentação quando ela acontecer.');
  const categoriaId = idOpcional(entrada.categoriaId, 'Escolha a categoria na lista.');
  if (categoriaId === null) throw new MovimentacaoInvalida('Escolha a categoria da movimentação.');
  const forma = deUmaLista(entrada.forma, FORMAS_MANUAIS, 'Escolha a forma: Pix, transferência, dinheiro ou cartão.');
  if (forma === null) throw new MovimentacaoInvalida('Escolha a forma: Pix, transferência, dinheiro ou cartão.');
  const descricao = typeof entrada.descricao === 'string' ? entrada.descricao.trim().replace(/\s+/g, ' ') : '';
  if (descricao.length < 3) throw new MovimentacaoInvalida('Descreva a movimentação, por exemplo: NF 685, limpeza de outubro.');
  if (descricao.length > 200) throw new MovimentacaoInvalida('Use no máximo 200 caracteres na descrição.');
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
