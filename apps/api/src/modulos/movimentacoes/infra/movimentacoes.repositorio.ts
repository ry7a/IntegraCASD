import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { deDia, paraDia } from '../../../compartilhado/datas.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import {
  limitesDoMes,
  type FiltrosDeMovimentacoes,
  type FormaPagamento,
  type OrigemMovimentacao,
  type TipoMovimentacao,
} from '../dominio/movimentacao.js';

export type Vinculo = { tipo: 'COBRANCA' | 'CONTRATO' | 'PROJETO' | 'FUNCIONARIO'; nome: string | null };

// A movimentação como a aplicação a enxerga: datas em "AAAA-MM-DD".
export type MovimentacaoRegistrada = {
  id: string;
  data: string;
  descricao: string;
  tipo: TipoMovimentacao;
  valorCentavos: number;
  categoriaNome: string;
  forma: FormaPagamento;
  origem: OrigemMovimentacao;
  contaNome: string;
  registradaPor: string | null;
  vinculo: Vinculo | null;
  // Preenchidos na original que foi estornada: quando, e o motivo (que fica no espelho).
  estornadaEm: string | null;
  motivoEstorno: string | null;
};

export type Totais = {
  entradasCentavos: number;
  quantidadeEntradas: number;
  saidasCentavos: number;
  quantidadeSaidas: number;
  saldoCentavos: number;
};

const INCLUSAO = {
  categoria: { select: { nome: true } },
  conta: { select: { nome: true } },
  registradaPor: { select: { nome: true } },
  contrato: { select: { codigo: true, contraparte: true } },
  projeto: { select: { nome: true } },
  funcionario: { select: { nome: true } },
  cobranca: { select: { aluno: { select: { nome: true } } } },
  estorno: { select: { data: true } },
} as const;

type RegistroDoBanco = Prisma.MovimentacaoGetPayload<{ include: typeof INCLUSAO }>;

function vinculoDe(registro: RegistroDoBanco): Vinculo | null {
  if (registro.cobranca) return { tipo: 'COBRANCA', nome: registro.cobranca.aluno.nome };
  if (registro.contrato) return { tipo: 'CONTRATO', nome: `${registro.contrato.codigo} · ${registro.contrato.contraparte}` };
  if (registro.projeto) return { tipo: 'PROJETO', nome: registro.projeto.nome };
  if (registro.funcionario) return { tipo: 'FUNCIONARIO', nome: registro.funcionario.nome };
  return null;
}

// Campo a campo (e não espalhando o registro): o banco tem colunas internas que não saem daqui.
function paraMovimentacao(registro: RegistroDoBanco, motivoDoEspelho: string | null): MovimentacaoRegistrada {
  return {
    id: registro.id,
    data: paraDia(registro.data),
    descricao: registro.descricao,
    tipo: registro.tipo,
    valorCentavos: registro.valorCentavos,
    categoriaNome: registro.categoria.nome,
    forma: registro.formaPagamento,
    origem: registro.origem,
    contaNome: registro.conta.nome,
    registradaPor: registro.registradaPor?.nome ?? null,
    vinculo: vinculoDe(registro),
    estornadaEm: registro.estorno ? paraDia(registro.estorno.data) : null,
    // O espelho guarda o motivo; a original mostra o mesmo texto. O próprio espelho mostra o seu.
    motivoEstorno: registro.motivoEstorno ?? motivoDoEspelho,
  };
}

// Acesso ao banco das movimentações [Movimentações.RF001 a RF003].
@Injectable()
export class MovimentacoesRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  // [Movimentações.RF003] A lista do recorte, das mais recentes para as mais antigas, e os totais.
  async listar(filtros: FiltrosDeMovimentacoes): Promise<{ itens: MovimentacaoRegistrada[]; totais: Totais }> {
    const { inicio, fim } = limitesDoMes(filtros.mes);
    const recorte: Prisma.MovimentacaoWhereInput = {
      data: { gte: deDia(inicio), lte: deDia(fim) },
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.categoriaId ? { categoriaId: filtros.categoriaId } : {}),
      ...(filtros.forma ? { formaPagamento: filtros.forma } : {}),
      ...(filtros.contratoId ? { contratoId: filtros.contratoId } : {}),
      ...(filtros.projetoId ? { projetoId: filtros.projetoId } : {}),
    };
    // Fora dos totais: o par estornada + espelho (se anula) e as transferências entre contas, que mudam
    // o saldo de cada conta mas não são receita nem despesa (MER, regra 4).
    const queConta: Prisma.MovimentacaoWhereInput = {
      ...recorte,
      origem: { not: 'ESTORNO' },
      estorno: { is: null },
      transferenciaParId: null,
      transferenciaParDe: { is: null },
    };
    const [registros, entradas, saidas] = await Promise.all([
      this.prisma.movimentacao.findMany({
        where: filtros.ocultarEstornos ? { ...recorte, origem: { not: 'ESTORNO' }, estorno: { is: null } } : recorte,
        include: { ...INCLUSAO, estorno: { select: { data: true, motivoEstorno: true } } },
        orderBy: [{ data: 'desc' }, { dataCriacao: 'desc' }],
      }),
      // AND, e não espalhando: o tipo do total não pode apagar o filtro de tipo do recorte.
      this.prisma.movimentacao.aggregate({ where: { AND: [queConta, { tipo: 'ENTRADA' }] }, _sum: { valorCentavos: true }, _count: { _all: true } }),
      this.prisma.movimentacao.aggregate({ where: { AND: [queConta, { tipo: 'SAIDA' }] }, _sum: { valorCentavos: true }, _count: { _all: true } }),
    ]);
    const entradasCentavos = entradas._sum.valorCentavos ?? 0;
    const saidasCentavos = saidas._sum.valorCentavos ?? 0;
    return {
      itens: registros.map((registro) => paraMovimentacao(registro, registro.estorno?.motivoEstorno ?? null)),
      totais: {
        entradasCentavos,
        quantidadeEntradas: entradas._count._all,
        saidasCentavos,
        quantidadeSaidas: saidas._count._all,
        saldoCentavos: entradasCentavos - saidasCentavos,
      },
    };
  }

  // O que o filtro e o diálogo "Nova movimentação" oferecem.
  async opcoes(anoCorrente: string): Promise<OpcoesDaMovimentacao> {
    const [contas, categorias, contratos, projetos, funcionarios, pagoNoAno] = await Promise.all([
      this.prisma.conta.findMany({ where: { ativo: true }, select: { id: true, nome: true, tipo: true }, orderBy: { nome: 'asc' } }),
      this.prisma.categoria.findMany({ where: { ativo: true }, select: { id: true, nome: true, tipo: true }, orderBy: { nome: 'asc' } }),
      this.prisma.contrato.findMany({
        where: { situacao: 'ATIVO' },
        select: { id: true, codigo: true, contraparte: true, objeto: true, valorCentavos: true, periodicidade: true },
        orderBy: { contraparte: 'asc' },
      }),
      this.prisma.projeto.findMany({
        where: { situacao: { not: 'CANCELADO' } },
        select: { id: true, codigo: true, nome: true, situacao: true },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.funcionario.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
      // [Movimentações.RF001] fluxo A1: total já pago em cada contrato no ano (saídas que contam).
      this.prisma.movimentacao.groupBy({
        by: ['contratoId'],
        where: {
          contratoId: { not: null },
          tipo: 'SAIDA',
          origem: { not: 'ESTORNO' },
          estorno: { is: null },
          data: { gte: deDia(`${anoCorrente}-01-01`), lte: deDia(`${anoCorrente}-12-31`) },
        },
        _sum: { valorCentavos: true },
      }),
    ]);
    const pagoPorContrato = new Map(pagoNoAno.map((grupo) => [grupo.contratoId, grupo._sum.valorCentavos ?? 0]));
    return {
      contas,
      categorias,
      contratos: contratos.map((contrato) => ({
        id: contrato.id,
        nome: `${contrato.codigo} · ${contrato.contraparte} (${contrato.objeto})`,
        valorCentavos: contrato.valorCentavos,
        periodicidade: contrato.periodicidade,
        pagoNoAnoCentavos: pagoPorContrato.get(contrato.id) ?? 0,
      })),
      projetos: projetos.map((projeto) => ({
        id: projeto.id,
        nome: `${projeto.codigo} · ${projeto.nome}`,
        // [Movimentações.RF001] fluxo A2: aceita, mas sinaliza.
        encerrado: projeto.situacao === 'EXECUTADO',
      })),
      funcionarios,
    };
  }
}

export type OpcoesDaMovimentacao = {
  contas: Array<{ id: string; nome: string; tipo: 'CORRENTE' | 'APLICACAO' }>;
  categorias: Array<{ id: string; nome: string; tipo: 'ENTRADA' | 'SAIDA' | 'AMBOS' }>;
  contratos: Array<{
    id: string;
    nome: string;
    valorCentavos: number;
    periodicidade: 'MENSAL' | 'ANUAL' | 'POR_DEMANDA' | 'UNICA';
    pagoNoAnoCentavos: number;
  }>;
  projetos: Array<{ id: string; nome: string; encerrado: boolean }>;
  funcionarios: Array<{ id: string; nome: string }>;
};
