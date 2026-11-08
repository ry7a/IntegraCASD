import { Injectable, Logger } from '@nestjs/common';
import { AgendadorDeRotinas, ROTINA_VIGILANCIA_DO_ASAAS } from '../fila/agendador-de-rotinas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { avaliarSaudeBasica, avaliarSaudeCompleta, type RespostaDaSaude } from './saude.js';

// Mede o que as rotas de saúde precisam (o banco responde? quando a vigilância rodou?) e entrega às
// regras de saude.ts. Nenhuma falha vira exceção: vira 503, e o motivo vai só para o log.
@Injectable()
export class ConferirSaude {
  private readonly logger = new Logger(ConferirSaude.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agendador: AgendadorDeRotinas,
  ) {}

  async basica(): Promise<RespostaDaSaude> {
    return avaliarSaudeBasica(await this.bancoResponde());
  }

  async completa(agora = new Date()): Promise<RespostaDaSaude> {
    const bancoResponde = await this.bancoResponde();
    const ultimaVigilanciaEm = await this.ultimaVigilancia();
    return avaliarSaudeCompleta({ bancoResponde, ultimaVigilanciaEm, agora });
  }

  private async bancoResponde(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (erro) {
      this.logger.warn(`Saúde: o banco não respondeu (${(erro as Error).message}).`);
      return false;
    }
  }

  // undefined = não deu para consultar (a avaliação trata como falha).
  private async ultimaVigilancia(): Promise<Date | null | undefined> {
    try {
      return await this.agendador.ultimaExecucaoConcluida(ROTINA_VIGILANCIA_DO_ASAAS);
    } catch (erro) {
      this.logger.warn(`Saúde: não foi possível consultar a vigilância do Asaas (${(erro as Error).message}).`);
      return undefined;
    }
  }
}
