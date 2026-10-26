import { Module } from '@nestjs/common';
import { AgendadorDeRotinas } from './agendador-de-rotinas.js';
import { AgendadorDeRotinasPgBoss } from './agendador-de-rotinas.pgboss.js';
import { FilaDeEventos } from './fila-de-eventos.js';
import { FilaDeEventosPgBoss } from './fila-de-eventos.pgboss.js';
import { PgBossService } from './pg-boss.service.js';

// Quem pede `FilaDeEventos` ou `AgendadorDeRotinas` recebe a implementação com pg-boss. Nos testes, cada teste
// entrega o dublê no lugar.
@Module({
  providers: [
    PgBossService,
    { provide: FilaDeEventos, useClass: FilaDeEventosPgBoss },
    { provide: AgendadorDeRotinas, useClass: AgendadorDeRotinasPgBoss },
  ],
  exports: [FilaDeEventos, AgendadorDeRotinas],
})
export class FilaModule {}
