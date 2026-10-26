import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { registrarNaTrilha } from '../../../compartilhado/auditoria/trilha.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import type { TipoDePendencia } from '../dominio/conciliacao.js';

export type NovaPendencia = {
  tipo: TipoDePendencia;
  origem: 'WEBHOOK' | 'SINCRONIZACAO';
  idAsaas: string;
  cobrancaId: string | null;
  eventoWebhookId: string | null;
  descricao: string;
};

export type PendenciaRegistrada = {
  id: string;
  tipo: TipoDePendencia;
  origem: 'WEBHOOK' | 'SINCRONIZACAO';
  idAsaas: string;
  cobrancaId: string | null;
  // Para a tela mostrar de quem é, quando a cobrança existe aqui.
  alunoNome: string | null;
  descricao: string;
  criadaEm: Date;
  resolvidaEm: Date | null;
  resolvidaPor: string | null;
  resolucao: string | null;
};

// Grava uma pendência dentro de uma transação em andamento. Se já houver uma aberta do mesmo tipo
// para a mesma cobrança do Asaas, não grava outra (índice único parcial + ON CONFLICT DO NOTHING,
// que não aborta a transação como um erro de duplicidade abortaria).
export async function registrarPendenciaNa(tx: Prisma.TransactionClient, pendencia: NovaPendencia): Promise<void> {
  await tx.pendenciaConciliacao.createMany({ data: [pendencia], skipDuplicates: true });
}

// Fila de pendências de conciliação [Cobranças.RF005] fluxo E1.
@Injectable()
export class PendenciasRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(pendencia: NovaPendencia): Promise<void> {
    await this.prisma.$transaction((tx) => registrarPendenciaNa(tx, pendencia));
  }

  async listar(abertas: boolean): Promise<PendenciaRegistrada[]> {
    const registros = await this.prisma.pendenciaConciliacao.findMany({
      where: { resolvidaEm: abertas ? null : { not: null } },
      // Abertas: as mais antigas primeiro (fila). Resolvidas: as mais recentes primeiro.
      orderBy: abertas ? { criadaEm: 'asc' } : { resolvidaEm: 'desc' },
      take: 200,
      include: { cobranca: { select: { aluno: { select: { nome: true } } } }, resolvidaPor: { select: { nome: true } } },
    });
    return registros.map((registro) => ({
      id: registro.id,
      tipo: registro.tipo,
      origem: registro.origem,
      idAsaas: registro.idAsaas,
      cobrancaId: registro.cobrancaId,
      alunoNome: registro.cobranca?.aluno.nome ?? null,
      descricao: registro.descricao,
      criadaEm: registro.criadaEm,
      resolvidaEm: registro.resolvidaEm,
      resolvidaPor: registro.resolvidaPor?.nome ?? null,
      resolucao: registro.resolucao,
    }));
  }

  async contarAbertas(): Promise<number> {
    return this.prisma.pendenciaConciliacao.count({ where: { resolvidaEm: null } });
  }

  // Marca como resolvida, com o texto de quem conferiu, e grava a trilha. Falso se não havia
  // pendência aberta com esse id (inexistente ou já resolvida).
  async resolver(id: string, resolucao: string, autorId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const resolvida = await tx.pendenciaConciliacao.updateMany({
        where: { id, resolvidaEm: null },
        data: { resolvidaEm: new Date(), resolvidaPorId: autorId, resolucao },
      });
      if (resolvida.count === 0) return false;
      await registrarNaTrilha(tx, {
        usuarioId: autorId,
        operacao: 'ALTERACAO',
        entidade: 'PENDENCIA',
        registroId: id,
        detalhe: `Pendência de conciliação resolvida: ${resolucao}`,
      });
      return true;
    });
  }
}
