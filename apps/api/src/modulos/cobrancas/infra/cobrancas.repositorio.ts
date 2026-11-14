import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { registrarNaTrilha } from '../../../compartilhado/auditoria/trilha.js';
import { deDia, paraDia } from '../../../compartilhado/datas.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import {
  CobrancaInvalida,
  type FiltrosDaConsulta,
  type OrigemDaCobranca,
  type OrigemEmitida,
  type PagamentoManual,
  type SituacaoExibida,
  type SituacaoGuardada,
} from '../dominio/cobranca.js';

export type { OrigemDaCobranca };

// A cobrança como a aplicação a enxerga: datas em "AAAA-MM-DD".
export type CobrancaRegistrada = {
  id: string;
  // Nulo só na HERDADA (o banco garante com CHECK).
  idAsaas: string | null;
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
  justificativaManual: string | null;
  // [Cobranças.RF007] Última conferência com o Asaas. Nulo = nunca.
  sincronizadaEm: Date | null;
  canceladaEm: Date | null;
  motivoCancelamento: string | null;
  // Renegociação: a cancelada que esta substitui, e a que substituiu esta.
  renegociacaoDeId: string | null;
  renegociadaPorId: string | null;
};

// O tipo da origem (OrigemEmitida) impede que um caso de uso grave por aqui uma cobrança herdada,
// que não passou pelo Asaas.
export type DadosDaNovaCobranca = {
  idAsaas: string;
  alunoId: string;
  origem: OrigemEmitida;
  referencia: string | null;
  descricao: string;
  valorCentavos: number;
  vencimento: string;
  multaPercentual: number;
  jurosMensalPercentual: number;
  urlBoleto: string | null;
  urlFatura: string | null;
  renegociacaoDeId?: string | null;
};

const INCLUSAO = { aluno: { select: { nome: true } }, renegociadaPor: { select: { id: true } } } as const;

type RegistroDoBanco = {
  id: string;
  idAsaas: string | null;
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
  justificativaManual: string | null;
  sincronizadaEm: Date | null;
  canceladaEm: Date | null;
  motivoCancelamento: string | null;
  renegociacaoDeId: string | null;
  renegociadaPor: { id: string } | null;
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
    justificativaManual: registro.justificativaManual,
    sincronizadaEm: registro.sincronizadaEm,
    canceladaEm: registro.canceladaEm,
    motivoCancelamento: registro.motivoCancelamento,
    renegociacaoDeId: registro.renegociacaoDeId,
    renegociadaPorId: registro.renegociadaPor?.id ?? null,
  };
}

// Acesso ao banco para cobranças e para o vínculo aluno -> cliente do Asaas.
@Injectable()
export class CobrancasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  // Fluxo A1 da geração: já existe mensalidade deste aluno para o mês?
  async existeMensalidade(alunoId: string, referencia: string): Promise<boolean> {
    const quantidade = await this.prisma.cobranca.count({ where: { alunoId, referencia } });
    return quantidade > 0;
  }

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
        detalhe:
          `Cobrança ${dados.origem === 'AVULSA' ? 'avulsa' : 'de mensalidade'} "${dados.descricao}" emitida no Asaas (${dados.idAsaas})` +
          (dados.renegociacaoDeId ? ', renegociando uma cobrança cancelada.' : '.'),
      });
      return paraCobranca(criada);
    });
  }

  // [Cobranças.RF004] Marca como cancelada (o Asaas já confirmou, ou a cobrança é herdada e não
  // existe lá) e registra motivo e autor. Como no pagamento manual, a atualização só vale se a cobrança
  // ainda estiver aberta: se outro usuário registrou o pagamento (ou a conciliação a baixou) nesse
  // meio-tempo, nada é gravado e o usuário é avisado, em vez de cancelar uma cobrança já paga.
  async cancelar(id: string, motivo: string, autorId: string, herdada = false): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const atualizada = await tx.cobranca.updateMany({
        where: { id, situacao: 'ABERTA' },
        data: { situacao: 'CANCELADA', canceladaEm: new Date(), motivoCancelamento: motivo },
      });
      if (atualizada.count === 0) {
        throw new CobrancaInvalida('A situação desta cobrança mudou enquanto você cancelava (por exemplo, o pagamento foi registrado). Atualize a página e confira.');
      }
      await registrarNaTrilha(tx, {
        usuarioId: autorId,
        operacao: 'CANCELAMENTO',
        entidade: 'COBRANCA',
        registroId: id,
        detalhe: herdada
          ? `Cobrança herdada da planilha cancelada (não existe no Asaas). Motivo: ${motivo}`
          : `Cobrança cancelada no Asaas e aqui. Motivo: ${motivo}`,
      });
    });
  }

  // [Cobranças.RF006] Pagamento fora do Asaas: entrada, cobrança e trilha na mesma transação
  // [Confiabilidade.NF004]. A atualização só vale se a cobrança ainda estiver aberta; se a
  // conciliação a baixou nesse meio-tempo, nada é gravado e o usuário é avisado.
  async registrarPagamentoManual(
    cobranca: { id: string; idAsaas: string | null; descricao: string },
    pagamento: PagamentoManual,
    destino: { contaId: string; categoriaId: string },
    autorId: string,
  ): Promise<void> {
    const identificacao = cobranca.idAsaas ?? 'herdada da planilha';
    await this.prisma.$transaction(async (tx) => {
      const entrada = await tx.movimentacao.create({
        data: {
          contaId: destino.contaId,
          categoriaId: destino.categoriaId,
          tipo: 'ENTRADA',
          valorCentavos: pagamento.valorCentavos,
          data: deDia(pagamento.pagoEm),
          formaPagamento: pagamento.formaPagamento,
          origem: 'REGISTRO_MANUAL_DE_COBRANCA',
          registradaPorId: autorId,
          descricao: `Cobrança "${cobranca.descricao}" (${identificacao}) paga fora do Asaas`,
        },
      });
      const atualizada = await tx.cobranca.updateMany({
        where: { id: cobranca.id, situacao: 'ABERTA' },
        data: {
          situacao: 'PAGA_COM_REGISTRO_MANUAL',
          pagaEm: deDia(pagamento.pagoEm),
          movimentacaoId: entrada.id,
          justificativaManual: pagamento.justificativa,
        },
      });
      if (atualizada.count === 0) {
        throw new CobrancaInvalida('A situação desta cobrança mudou enquanto você registrava (por exemplo, o Asaas confirmou o pagamento). Atualize a página e confira.');
      }
      await registrarNaTrilha(tx, {
        usuarioId: autorId,
        operacao: 'ALTERACAO',
        entidade: 'COBRANCA',
        registroId: cobranca.id,
        detalhe: `Pagamento registrado manualmente em ${pagamento.pagoEm}. Justificativa: ${pagamento.justificativa}`,
      });
      await registrarNaTrilha(tx, {
        usuarioId: autorId,
        operacao: 'INCLUSAO',
        entidade: 'MOVIMENTACAO',
        registroId: entrada.id,
        detalhe: `Entrada do pagamento manual da cobrança "${cobranca.descricao}" (${identificacao}).`,
      });
    });
  }

  // [Cobranças.RF003] Registra no histórico da cobrança quem obteve o boleto, e quando.
  async registrarObtencaoDoBoleto(cobrancaId: string, autorId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await registrarNaTrilha(tx, {
        usuarioId: autorId,
        operacao: 'OBTENCAO_DE_BOLETO',
        entidade: 'COBRANCA',
        registroId: cobrancaId,
        detalhe: 'Boleto obtido para entrega por outro meio.',
      });
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

  // [Cadastros.RF001] Todas as cobranças de um aluno, das mais recentes para as mais antigas.
  async listarDoAluno(alunoId: string): Promise<CobrancaRegistrada[]> {
    const registros = await this.prisma.cobranca.findMany({
      where: { alunoId },
      include: INCLUSAO,
      orderBy: [{ vencimento: 'desc' }, { dataCriacao: 'desc' }],
    });
    return registros.map(paraCobranca);
  }

  // Por aluno com cobrança aberta: quanto está em aberto (vencida ou não) e quanto já venceu.
  async totaisEmAbertoPorAluno(hoje: string): Promise<TotaisDoAluno[]> {
    const [abertas, vencidas] = await Promise.all([
      this.prisma.cobranca.groupBy({ by: ['alunoId'], where: { situacao: 'ABERTA' }, _sum: { valorCentavos: true } }),
      this.prisma.cobranca.groupBy({
        by: ['alunoId'],
        where: { situacao: 'ABERTA', vencimento: { lt: deDia(hoje) } },
        _sum: { valorCentavos: true },
        _count: { _all: true },
      }),
    ]);
    const vencidasPorAluno = new Map(vencidas.map((grupo) => [grupo.alunoId, grupo]));
    return abertas.map((grupo) => {
      const vencida = vencidasPorAluno.get(grupo.alunoId);
      return {
        alunoId: grupo.alunoId,
        totalEmAbertoCentavos: grupo._sum.valorCentavos ?? 0,
        quantidadeVencidas: vencida?._count._all ?? 0,
        totalVencidoCentavos: vencida?._sum.valorCentavos ?? 0,
      };
    });
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
  // A herdada não existe no Asaas: não tem avisos do webhook.
  async historico(cobranca: { id: string; idAsaas: string | null }): Promise<EventoDaCobranca[]> {
    const { idAsaas } = cobranca;
    const [trilha, avisos] = await Promise.all([
      this.prisma.registroAuditoria.findMany({
        where: { entidade: 'COBRANCA', registroId: cobranca.id },
        include: { usuario: { select: { nome: true } } },
      }),
      idAsaas === null
        ? Promise.resolve([])
        : this.prisma.eventoWebhook.findMany({ where: { payload: { path: ['payment', 'id'], equals: idAsaas } } }),
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

export type TotaisDoAluno = {
  alunoId: string;
  // Abertas, vencidas ou não.
  totalEmAbertoCentavos: number;
  quantidadeVencidas: number;
  totalVencidoCentavos: number;
};

export type EventoDaCobranca = { id: string; ocorridoEm: Date; descricao: string; origem: 'ASAAS' | 'USUARIO' };

// O `contains` do Prisma vira um LIKE no PostgreSQL, onde % (qualquer sequência) e _ (qualquer caractere)
// são curingas e \ é o escape. O Prisma não os escapa: sem isto, buscar "%" trazia todas as cobranças.
// A barra vai primeiro, para não escapar de novo as barras que a própria troca acrescenta.
function textoLiteralNoLike(texto: string): string {
  return texto.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

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
          { nome: { contains: textoLiteralNoLike(filtros.busca), mode: 'insensitive' } },
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
