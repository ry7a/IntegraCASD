import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PgBoss, type ConstructorOptions } from 'pg-boss';
import type { Processo } from '../configuracao.js';
import { ROTINAS } from './agendador-de-rotinas.js';

// Nome da fila dos eventos do webhook. O pg-boss exige criar a fila antes de usá-la.
export const FILA_EVENTOS_ASAAS = 'eventos-asaas';

// Schema do PostgreSQL onde o pg-boss guarda as filas e os jobs. É o padrão dele, mas fica explícito
// porque o AgendadorDeRotinasPgBoss consulta a tabela de jobs direto (ultimaExecucaoConcluida).
export const SCHEMA_DO_PGBOSS = 'pgboss';

// Em qual processo este código está rodando. O padrão é 'api' (vale também para os scripts, como o
// gerar-openapi); o main-worker.ts chama definirProcessoDaFila('worker') ANTES de montar a aplicação,
// porque as opções do pg-boss só podem ser dadas no construtor. Uma variável do arquivo, e não do .env,
// para ninguém conseguir ligar o modo worker na API por engano. Se o worker esquecer de chamar, as
// rotinas param de disparar e a /api/saude/completa acusa (a vigilância deixa de rodar).
let processoAtual: Processo = 'api';

export function definirProcessoDaFila(processo: Processo): void {
  processoAtual = processo;
}

// Opções do pg-boss para cada processo. Só o worker roda o agendamento (cron: dispara as rotinas na hora
// marcada) e a supervisão (manutenção da fila: expira jobs travados, apaga os antigos, mede as filas).
// A API só envia jobs e cria filas. As migrações do schema "pgboss" ficam ligadas nos dois: na primeira
// subida da produção a API sobe antes do worker e já precisa enfileirar os webhooks.
export function opcoesDoPgBoss(urlDoBanco: string, processo: Processo): ConstructorOptions {
  const ehWorker = processo === 'worker';
  return {
    connectionString: urlDoBanco,
    schema: SCHEMA_DO_PGBOSS,
    schedule: ehWorker,
    supervise: ehWorker,
    migrate: true,
  };
}

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
    this.boss = new PgBoss(opcoesDoPgBoss(urlDoBanco, processoAtual));
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
