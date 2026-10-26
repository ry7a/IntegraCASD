import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { EntidadeAuditada, OperacaoAuditada } from '../../../compartilhado/auditoria/trilha.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { ROTINA_AUTOMATICA, intervaloEmSaoPaulo, type FiltrosDaTrilha } from '../dominio/trilha.js';

export type RegistroDaTrilha = {
  id: string;
  ocorridoEm: Date;
  // Nulo = rotina automática.
  usuarioNome: string | null;
  operacao: OperacaoAuditada;
  entidade: EntidadeAuditada;
  registroId: string | null;
  detalhe: string;
};

// Leitura da trilha [Administração.RF005]. Só consulta: a gravação é só pelo registrarNaTrilha
// (regra B13), e o banco recusa alterar ou apagar (ADR-0004, fluxo E1).
@Injectable()
export class TrilhaRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: FiltrosDaTrilha): Promise<{ itens: RegistroDaTrilha[]; total: number }> {
    const { inicio, fim } = intervaloEmSaoPaulo(filtros.de, filtros.ate);
    const onde: Prisma.RegistroAuditoriaWhereInput = {
      ocorridoEm: { gte: inicio, lt: fim },
      ...(filtros.usuario === null ? {} : { usuarioId: filtros.usuario === ROTINA_AUTOMATICA ? null : filtros.usuario }),
      ...(filtros.operacao === null ? {} : { operacao: filtros.operacao }),
      ...(filtros.entidade === null ? {} : { entidade: filtros.entidade }),
      ...(filtros.registroId === null ? {} : { registroId: filtros.registroId }),
    };
    const [registros, total] = await this.prisma.$transaction([
      this.prisma.registroAuditoria.findMany({
        where: onde,
        include: { usuario: { select: { nome: true } } },
        orderBy: { ocorridoEm: 'desc' },
        skip: (filtros.pagina - 1) * filtros.tamanhoPagina,
        take: filtros.tamanhoPagina,
      }),
      this.prisma.registroAuditoria.count({ where: onde }),
    ]);
    return {
      itens: registros.map((registro) => ({
        id: registro.id,
        ocorridoEm: registro.ocorridoEm,
        usuarioNome: registro.usuario?.nome ?? null,
        // A coluna é texto; só o registrarNaTrilha grava, sempre com os valores das listas.
        operacao: registro.operacao as OperacaoAuditada,
        entidade: registro.entidade as EntidadeAuditada,
        registroId: registro.registroId,
        detalhe: registro.detalhe,
      })),
      total,
    };
  }
}
