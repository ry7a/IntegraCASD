import { Injectable, Logger } from '@nestjs/common';
import { AgendadorDeRotinas, ROTINA_VIGILANCIA_DO_ASAAS } from '../fila/agendador-de-rotinas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { avaliarSaudeBasica, avaliarSaudeCompleta, type RespostaDaSaude } from './saude.js';

// Por quanto tempo a resposta da saúde completa é reaproveitada. A rota é pública: sem isto, uma enxurrada
// de pedidos anônimos viraria uma enxurrada de consultas ao banco. O monitor externo consulta a cada
// poucos minutos, então 30 s de atraso não mudam nada para ele.
export const CACHE_DA_SAUDE_COMPLETA_MS = 30 * 1000;

// Mede o que as rotas de saúde precisam (o banco responde? quando a vigilância rodou?) e entrega às
// regras de saude.ts. Nenhuma falha vira exceção: vira 503, e o motivo vai só para o log.
@Injectable()
export class ConferirSaude {
  private readonly logger = new Logger(ConferirSaude.name);
  // Guarda a promessa (e não só o resultado): pedidos que chegam enquanto a primeira conferência ainda
  // está rodando esperam por ela, em vez de cada um abrir a sua. completa() nunca rejeita (falha vira 503).
  private ultimaCompleta: { calculadaEm: number; resposta: Promise<RespostaDaSaude> } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly agendador: AgendadorDeRotinas,
  ) {}

  async basica(): Promise<RespostaDaSaude> {
    return avaliarSaudeBasica(await this.bancoResponde());
  }

  completa(agora = new Date()): Promise<RespostaDaSaude> {
    const cache = this.ultimaCompleta;
    if (cache !== null) {
      // idade negativa = o relógio voltou; nesse caso confere de novo em vez de confiar no cache.
      const idade = agora.getTime() - cache.calculadaEm;
      if (idade >= 0 && idade < CACHE_DA_SAUDE_COMPLETA_MS) return cache.resposta;
    }
    const resposta = this.conferirCompleta(agora);
    this.ultimaCompleta = { calculadaEm: agora.getTime(), resposta };
    return resposta;
  }

  private async conferirCompleta(agora: Date): Promise<RespostaDaSaude> {
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
