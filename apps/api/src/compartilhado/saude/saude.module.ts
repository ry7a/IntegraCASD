import { Module } from '@nestjs/common';
import { FilaModule } from '../fila/fila.module.js';
import { ConferirSaude } from './conferir-saude.js';
import { SaudeController } from './saude.controller.js';

// Saúde da API e do worker. Fica em compartilhado/ (e não num módulo de domínio) porque não é regra de
// negócio: só precisa do banco (PrismaModule, global) e da fila, que também são compartilhados. Assim
// não importa nenhum módulo (regra B1) e só entra no AppModule, nunca no worker.
@Module({
  imports: [FilaModule],
  controllers: [SaudeController],
  providers: [ConferirSaude],
})
export class SaudeModule {}
