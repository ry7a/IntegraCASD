import { Module } from '@nestjs/common';
import { FilaDeEventos } from './fila-de-eventos.js';
import { FilaDeEventosPgBoss } from './fila-de-eventos.pgboss.js';
import { PgBossService } from './pg-boss.service.js';

// Quem pede `FilaDeEventos` recebe a implementação com pg-boss. Nos testes, cada teste
// entrega o dublê no lugar.
@Module({
  providers: [PgBossService, { provide: FilaDeEventos, useClass: FilaDeEventosPgBoss }],
  exports: [FilaDeEventos],
})
export class FilaModule {}
