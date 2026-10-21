import { Module } from '@nestjs/common';
import { PrismaModule } from './compartilhado/prisma/prisma.module.js';
import { CobrancasModule } from './modulos/cobrancas/index.js';

// Módulo raiz do worker: o mesmo código da API, sem porta HTTP. Reúne só o que o
// processamento em segundo plano precisa.
@Module({
  imports: [PrismaModule, CobrancasModule],
})
export class WorkerModule {}
