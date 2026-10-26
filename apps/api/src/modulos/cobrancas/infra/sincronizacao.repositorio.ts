import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { registrarNaTrilha } from '../../../compartilhado/auditoria/trilha.js';
import { deDia, paraDia } from '../../../compartilhado/datas.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import type { CobrancaParaConciliar } from './conciliacao.repositorio.js';

export type ResumoDaSincronizacao = {
  conferidas: number;
  atualizadas: number;
  somenteNoAsaas: number;
  naoIdentificadas: number;
  paraConferir: number;
  falha: string | null;
};

export type ExecucaoDaSincronizacao = ResumoDaSincronizacao & {
  id: string;
  iniciadaEm: Date;
  finalizadaEm: Date | null;
};

export type NovaExecucao =
  | { origem: 'AGENDADA' | 'MANUAL'; vencimentoDe: string; vencimentoAte: string; pedidaPorId: string | null }
  | { origem: 'MANUAL'; cobrancaId: string; pedidaPorId: string };

// Cobrança encontrada só no Asaas, para ser registrada aqui.
export type CobrancaTrazidaDoAsaas = {
  idAsaas: string;
  alunoId: string;
  origem: 'MENSALIDADE' | 'AVULSA';
  referencia: string | null;
  descricao: string;
  valorCentavos: number;
  vencimento: string;
  multaPercentual: number;
  jurosMensalPercentual: number;
  urlBoleto: string | null;
  urlFatura: string | null;
};

const SELECAO_PARA_CONCILIAR = {
  id: true,
  idAsaas: true,
  origem: true,
  descricao: true,
  situacao: true,
  valorCentavos: true,
  disponivelEm: true,
  movimentacaoId: true,
} as const;

// Acesso ao banco da sincronização com o Asaas [Cobranças.RF007], [Confiabilidade.NF007].
@Injectable()
export class SincronizacaoRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async iniciar(execucao: NovaExecucao): Promise<string> {
    const criada = await this.prisma.execucaoSincronizacao.create({
      data:
        'cobrancaId' in execucao
          ? { origem: execucao.origem, cobrancaId: execucao.cobrancaId, pedidaPorId: execucao.pedidaPorId }
          : {
              origem: execucao.origem,
              vencimentoDe: deDia(execucao.vencimentoDe),
              vencimentoAte: deDia(execucao.vencimentoAte),
              pedidaPorId: execucao.pedidaPorId,
            },
    });
    return criada.id;
  }

  async finalizar(id: string, resumo: ResumoDaSincronizacao): Promise<ExecucaoDaSincronizacao> {
    const finalizada = await this.prisma.execucaoSincronizacao.update({
      where: { id },
      data: { ...resumo, finalizadaEm: new Date() },
    });
    return paraExecucao(finalizada);
  }

  // A última sincronização geral (de período) concluída, para o resumo da lista de cobranças.
  async ultimaGeral(): Promise<ExecucaoDaSincronizacao | null> {
    const ultima = await this.prisma.execucaoSincronizacao.findFirst({
      where: { cobrancaId: null, finalizadaEm: { not: null } },
      orderBy: { iniciadaEm: 'desc' },
    });
    return ultima === null ? null : paraExecucao(ultima);
  }

  async cobrancasDoPeriodo(vencimentoDe: string, vencimentoAte: string): Promise<CobrancaParaConciliar[]> {
    const registros = await this.prisma.cobranca.findMany({
      where: { vencimento: { gte: deDia(vencimentoDe), lte: deDia(vencimentoAte) } },
      select: SELECAO_PARA_CONCILIAR,
    });
    return registros.map((registro) => ({
      ...registro,
      disponivelEm: registro.disponivelEm === null ? null : paraDia(registro.disponivelEm),
    }));
  }

  async marcarSincronizadas(ids: string[], quando: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.cobranca.updateMany({ where: { id: { in: ids } }, data: { sincronizadaEm: quando } });
  }

  async alunoDoClienteAsaas(idCliente: string): Promise<string | null> {
    const vinculo = await this.prisma.clienteAsaas.findUnique({ where: { idAsaas: idCliente }, select: { alunoId: true } });
    return vinculo?.alunoId ?? null;
  }

  async alunoExiste(alunoId: string): Promise<boolean> {
    return (await this.prisma.aluno.count({ where: { id: alunoId } })) > 0;
  }

  async existeMensalidade(alunoId: string, referencia: string): Promise<boolean> {
    return (await this.prisma.cobranca.count({ where: { alunoId, referencia } })) > 0;
  }

  // Registra aqui uma cobrança que só existia no Asaas, com a trilha, na mesma transação.
  // Devolve nulo se outra operação a registrou nesse meio-tempo (id do Asaas é único).
  async registrarTrazidaDoAsaas(dados: CobrancaTrazidaDoAsaas, autorId: string | null): Promise<CobrancaParaConciliar | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const criada = await tx.cobranca.create({
          data: { ...dados, vencimento: deDia(dados.vencimento), emitidaPorId: null },
          select: SELECAO_PARA_CONCILIAR,
        });
        await registrarNaTrilha(tx, {
          usuarioId: autorId,
          operacao: 'INCLUSAO',
          entidade: 'COBRANCA',
          registroId: criada.id,
          detalhe: `Cobrança "${dados.descricao}" (${dados.idAsaas}) encontrada no Asaas e registrada aqui pela sincronização.`,
        });
        return { ...criada, disponivelEm: null };
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') return null;
      throw erro;
    }
  }
}

function paraExecucao(registro: {
  id: string;
  iniciadaEm: Date;
  finalizadaEm: Date | null;
  conferidas: number;
  atualizadas: number;
  somenteNoAsaas: number;
  naoIdentificadas: number;
  paraConferir: number;
  falha: string | null;
}): ExecucaoDaSincronizacao {
  return {
    id: registro.id,
    iniciadaEm: registro.iniciadaEm,
    finalizadaEm: registro.finalizadaEm,
    conferidas: registro.conferidas,
    atualizadas: registro.atualizadas,
    somenteNoAsaas: registro.somenteNoAsaas,
    naoIdentificadas: registro.naoIdentificadas,
    paraConferir: registro.paraConferir,
    falha: registro.falha,
  };
}
