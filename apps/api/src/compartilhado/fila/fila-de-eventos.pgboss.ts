import { Injectable } from '@nestjs/common';
import { FilaDeEventos } from './fila-de-eventos.js';
import { FILA_EVENTOS_ASAAS, PgBossService } from './pg-boss.service.js';

// Dados do job: só o id do evento. O evento em si já está gravado no banco.
interface DadosDoJob {
  eventoId: string;
}

// Implementação real da fila, sobre o pg-boss. É o único lugar que conhece a API dele.
@Injectable()
export class FilaDeEventosPgBoss extends FilaDeEventos {
  constructor(private readonly pgBoss: PgBossService) {
    super();
  }

  async enfileirarProcessamento(eventoId: string): Promise<void> {
    await this.pgBoss.boss.send(FILA_EVENTOS_ASAAS, { eventoId } satisfies DadosDoJob, {
      // Se o processamento falhar, o pg-boss tenta de novo, esperando cada vez mais.
      retryLimit: 5,
      retryDelay: 30,
      retryBackoff: true,
    });
  }

  async consumir(processar: (eventoId: string) => Promise<void>): Promise<void> {
    // O pg-boss entrega os jobs em lote (uma lista). Se um deles falhar, o erro sobe e o
    // pg-boss tenta o lote de novo; por isso o processamento precisa ser idempotente.
    await this.pgBoss.boss.work<DadosDoJob>(FILA_EVENTOS_ASAAS, async (jobs) => {
      for (const job of jobs) {
        await processar(job.data.eventoId);
      }
    });
  }
}
