import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { ROTINAS } from './agendador-de-rotinas.js';

// Nome da fila dos eventos do webhook. O pg-boss exige criar a fila antes de usá-la.
export const FILA_EVENTOS_ASAAS = 'eventos-asaas';

// Dono da conexão com o pg-boss. A API e o worker têm, cada um, a sua instância: a API só
// envia jobs, o worker também os consome. O pg-boss guarda tudo no próprio PostgreSQL
// (schema "pgboss", criado sozinho na primeira vez), sem nenhum serviço novo.
@Injectable()
export class PgBossService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgBossService.name);
  readonly boss: PgBoss;

  constructor() {
    const urlDoBanco = process.env.DATABASE_URL;
    if (urlDoBanco === undefined || urlDoBanco === '') {
      throw new Error('DATABASE_URL não está preenchida no .env.');
    }
    this.boss = new PgBoss(urlDoBanco);
    // Sem um listener de 'error', o Node derruba o processo quando o pg-boss reporta um erro.
    this.boss.on('error', (erro) => this.logger.error(`Erro no pg-boss: ${erro.message}`));
  }

  async onModuleInit() {
    await this.boss.start();
    await this.boss.createQueue(FILA_EVENTOS_ASAAS);
    // Rotinas automáticas: cada uma com a sua fila, no máximo uma execução por vez ("singleton").
    for (const rotina of ROTINAS) {
      await this.boss.createQueue(rotina, { policy: 'singleton' });
    }
  }

  // Termina os jobs em andamento e fecha as conexões ao encerrar a API ou o worker.
  async onModuleDestroy() {
    await this.boss.stop();
  }
}
