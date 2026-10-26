import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { Prisma } from '../../../generated/prisma/client.js';
import type { EventoWebhook } from '../../../generated/prisma/client.js';

export interface EventoRecebido {
  idAsaas: string;
  tipo: string;
  payload: Prisma.InputJsonValue;
}

export interface EventoRegistrado {
  evento: EventoWebhook;
  // false quando o Asaas reenviou um evento que já estava gravado.
  novo: boolean;
}

// Acesso ao banco para os eventos do webhook. Só esta camada conhece o Prisma.
@Injectable()
export class EventosWebhookRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  // Ids dos eventos gravados antes de `gravadosAntesDe` e ainda sem processar, os mais antigos primeiro.
  async listarNaoProcessados(gravadosAntesDe: Date, limite: number): Promise<string[]> {
    const eventos = await this.prisma.eventoWebhook.findMany({
      where: { processadoEm: null, dataCriacao: { lt: gravadosAntesDe } },
      orderBy: { dataCriacao: 'asc' },
      take: limite,
      select: { id: true },
    });
    return eventos.map((evento) => evento.id);
  }

  buscarPorId(id: string): Promise<EventoWebhook | null> {
    return this.prisma.eventoWebhook.findUnique({ where: { id } });
  }

  // Grava o evento. Quem garante que um evento repetido não vira dois registros é o
  // índice UNIQUE de id_asaas no banco: se o INSERT falha por duplicidade (código P2002 do
  // Prisma), buscamos o registro que já existia. Assim nem duas requisições simultâneas
  // conseguem gravar o mesmo evento duas vezes. [Confiabilidade.NF003]
  async registrar(dados: EventoRecebido): Promise<EventoRegistrado> {
    try {
      const evento = await this.prisma.eventoWebhook.create({ data: dados });
      return { evento, novo: true };
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        const evento = await this.prisma.eventoWebhook.findUniqueOrThrow({
          where: { idAsaas: dados.idAsaas },
        });
        return { evento, novo: false };
      }
      throw erro;
    }
  }
}
