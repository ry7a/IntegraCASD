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
