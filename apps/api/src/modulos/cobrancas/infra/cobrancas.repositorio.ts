import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { registrarNaTrilha } from '../../../compartilhado/auditoria/trilha.js';
import { deDia, paraDia } from '../../../compartilhado/datas.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import type { FiltrosDaConsulta, SituacaoExibida, SituacaoGuardada } from '../dominio/cobranca.js';

export type OrigemDaCobranca = 'MENSALIDADE' | 'AVULSA';

// A cobrança como a aplicação a enxerga: datas em "AAAA-MM-DD".
export type CobrancaRegistrada = {
  id: string;
  idAsaas: string;
  alunoId: string;
  alunoNome: string;
  origem: OrigemDaCobranca;
  referencia: string | null;
  descricao: string;
  valorCentavos: number;
  vencimento: string;
  multaPercentual: number;
  jurosMensalPercentual: number;
  situacao: SituacaoGuardada;
  urlBoleto: string | null;
  urlFatura: string | null;
  pagaEm: string | null;
};

export type DadosDaNovaCobranca = {
  idAsaas: string;
  alunoId: string;
  origem: OrigemDaCobranca;
  referencia: string | null;
  descricao: string;
  valorCentavos: number;
  vencimento: string;
  multaPercentual: number;
  jurosMensalPercentual: number;
  urlBoleto: string | null;
  urlFatura: string | null;
};

const INCLUSAO = { aluno: { select: { nome: true } } } as const;

type RegistroDoBanco = {
  id: string;
  idAsaas: string;
  alunoId: string;
  aluno: { nome: string };
  origem: OrigemDaCobranca;
  referencia: string | null;
  descricao: string;
  valorCentavos: number;
  vencimento: Date;
  multaPercentual: number;
  jurosMensalPercentual: number;
  situacao: SituacaoGuardada;
  urlBoleto: string | null;
  urlFatura: string | null;
  pagaEm: Date | null;
};

// Campo a campo (e não espalhando o registro): o banco tem colunas internas que não saem daqui.
function paraCobranca(registro: RegistroDoBanco): CobrancaRegistrada {
  return {
    id: registro.id,
    idAsaas: registro.idAsaas,
    alunoId: registro.alunoId,
    alunoNome: registro.aluno.nome,
    origem: registro.origem,
    referencia: registro.referencia,
    descricao: registro.descricao,
    valorCentavos: registro.valorCentavos,
    vencimento: paraDia(registro.vencimento),
    multaPercentual: registro.multaPercentual,
    jurosMensalPercentual: registro.jurosMensalPercentual,
    situacao: registro.situacao,
    urlBoleto: registro.urlBoleto,
    urlFatura: registro.urlFatura,
    pagaEm: registro.pagaEm === null ? null : paraDia(registro.pagaEm),
  };
}

// Acesso ao banco para cobranças e para o vínculo aluno -> cliente do Asaas.
@Injectable()
export class CobrancasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async idClienteAsaasDoAluno(alunoId: string): Promise<string | null> {
    const vinculo = await this.prisma.clienteAsaas.findUnique({ where: { alunoId } });
    return vinculo?.idAsaas ?? null;
  }

  async registrarClienteAsaas(alunoId: string, idAsaas: string): Promise<void> {
    await this.prisma.clienteAsaas.create({ data: { alunoId, idAsaas } });
  }

  // Grava a cobrança que o Asaas acabou de criar, com a trilha, na mesma transação.
  // `autorId` nulo = rotina automática (geração recorrente).
  async registrar(dados: DadosDaNovaCobranca, autorId: string | null): Promise<CobrancaRegistrada> {
    return this.prisma.$transaction(async (tx) => {
      const criada = await tx.cobranca.create({
        data: { ...dados, vencimento: deDia(dados.vencimento), emitidaPorId: autorId },
        include: INCLUSAO,
      });
      await registrarNaTrilha(tx, {
        usuarioId: autorId,
        operacao: 'INCLUSAO',
        entidade: 'COBRANCA',
        registroId: criada.id,
        detalhe: `Cobrança ${dados.origem === 'AVULSA' ? 'avulsa' : 'de mensalidade'} "${dados.descricao}" emitida no Asaas (${dados.idAsaas}).`,
      });
      return paraCobranca(criada);
    });
  }

  // [Cobranças.RF008] Lista filtrada, por vencimento. "Vencida" é aberta com vencimento antes de hoje.
  async listar(filtros: FiltrosDaConsulta, hoje: string): Promise<{ itens: CobrancaRegistrada[]; total: number }> {
    const onde = condicoesDaConsulta(filtros, hoje);
    const [registros, total] = await this.prisma.$transaction([
      this.prisma.cobranca.findMany({
        where: onde,
        include: INCLUSAO,
        orderBy: [{ vencimento: 'asc' }, { dataCriacao: 'asc' }],
        skip: (filtros.pagina - 1) * filtros.tamanhoPagina,
        take: filtros.tamanhoPagina,
      }),
      this.prisma.cobranca.count({ where: onde }),
    ]);
    return { itens: registros.map(paraCobranca), total };
  }

  // Totais por situação: abertas e vencidas, todas; as demais, só as que mudaram de situação no mês
  // corrente (pagas pela data do pagamento, canceladas pela data do cancelamento).
  async resumir(hoje: string, inicioDoMes: string): Promise<Array<{ situacao: SituacaoExibida; quantidade: number; valorCentavos: number }>> {
    const contar = async (onde: Prisma.CobrancaWhereInput) => {
      const resultado = await this.prisma.cobranca.aggregate({ where: onde, _count: { _all: true }, _sum: { valorCentavos: true } });
      return { quantidade: resultado._count._all, valorCentavos: resultado._sum.valorCentavos ?? 0 };
    };
    const noMes = { gte: deDia(inicioDoMes) };
    return [
      { situacao: 'ABERTA', ...(await contar({ situacao: 'ABERTA', vencimento: { gte: deDia(hoje) } })) },
      { situacao: 'VENCIDA', ...(await contar({ situacao: 'ABERTA', vencimento: { lt: deDia(hoje) } })) },
      { situacao: 'PAGA', ...(await contar({ situacao: 'PAGA', pagaEm: noMes })) },
      { situacao: 'PAGA_COM_REGISTRO_MANUAL', ...(await contar({ situacao: 'PAGA_COM_REGISTRO_MANUAL', pagaEm: noMes })) },
      { situacao: 'CANCELADA', ...(await contar({ situacao: 'CANCELADA', canceladaEm: noMes })) },
      { situacao: 'ESTORNADA', ...(await contar({ situacao: 'ESTORNADA', dataAlteracao: noMes })) },
    ];
  }

  // Quando chegou a última notificação do Asaas (qualquer evento do webhook).
  async ultimaNotificacaoEm(): Promise<Date | null> {
    const ultima = await this.prisma.eventoWebhook.findFirst({ orderBy: { dataCriacao: 'desc' }, select: { dataCriacao: true } });
    return ultima?.dataCriacao ?? null;
  }

  async buscarPorId(id: string): Promise<CobrancaRegistrada | null> {
    const registro = await this.prisma.cobranca.findUnique({ where: { id }, include: INCLUSAO });
    return registro === null ? null : paraCobranca(registro);
  }

  // Histórico da cobrança: o que os usuários e rotinas fizeram (trilha) e o que o Asaas avisou (webhook).
  async historico(cobranca: { id: string; idAsaas: string }): Promise<EventoDaCobranca[]> {
    const [trilha, avisos] = await Promise.all([
      this.prisma.registroAuditoria.findMany({
        where: { entidade: 'COBRANCA', registroId: cobranca.id },
        include: { usuario: { select: { nome: true } } },
      }),
      this.prisma.eventoWebhook.findMany({ where: { payload: { path: ['payment', 'id'], equals: cobranca.idAsaas } } }),
    ]);
    const eventos: EventoDaCobranca[] = [
      ...trilha.map((registro) => ({
        id: registro.id,
        ocorridoEm: registro.ocorridoEm,
        descricao: `${registro.detalhe} (${registro.usuario?.nome ?? 'rotina automática'})`,
        origem: 'USUARIO' as const,
      })),
      ...avisos.map((evento) => ({
        id: evento.id,
        ocorridoEm: evento.dataCriacao,
        descricao: `Aviso do Asaas: ${evento.tipo}`,
        origem: 'ASAAS' as const,
      })),
    ];
    return eventos.sort((a, b) => b.ocorridoEm.getTime() - a.ocorridoEm.getTime());
  }
}

export type EventoDaCobranca = { id: string; ocorridoEm: Date; descricao: string; origem: 'ASAAS' | 'USUARIO' };

// Traduz os filtros do domínio para a consulta do Prisma.
function condicoesDaConsulta(filtros: FiltrosDaConsulta, hoje: string): Prisma.CobrancaWhereInput {
  const porSituacao: Prisma.CobrancaWhereInput[] = filtros.situacoes.map((situacao) => {
    if (situacao === 'ABERTA') return { situacao: 'ABERTA', vencimento: { gte: deDia(hoje) } };
    if (situacao === 'VENCIDA') return { situacao: 'ABERTA', vencimento: { lt: deDia(hoje) } };
    return { situacao };
  });
  const condicoes: Prisma.CobrancaWhereInput[] = [{ OR: porSituacao }];
  if (filtros.alunoId !== null) condicoes.push({ alunoId: filtros.alunoId });
  if (filtros.busca !== null) {
    const digitos = filtros.busca.replace(/\D/g, '');
    condicoes.push({
      aluno: {
        OR: [
          { nome: { contains: filtros.busca, mode: 'insensitive' } },
          ...(digitos.length >= 3 ? [{ cpf: { contains: digitos } }] : []),
        ],
      },
    });
  }
  if (filtros.vencimentoDe !== null) condicoes.push({ vencimento: { gte: deDia(filtros.vencimentoDe) } });
  if (filtros.vencimentoAte !== null) condicoes.push({ vencimento: { lte: deDia(filtros.vencimentoAte) } });
  if (filtros.valorMinimoCentavos !== null) condicoes.push({ valorCentavos: { gte: filtros.valorMinimoCentavos } });
  if (filtros.valorMaximoCentavos !== null) condicoes.push({ valorCentavos: { lte: filtros.valorMaximoCentavos } });
  return { AND: condicoes };
}
