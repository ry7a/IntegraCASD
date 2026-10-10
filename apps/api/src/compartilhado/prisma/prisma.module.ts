import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// @Global: registrado uma vez no AppModule, o PrismaService fica disponível para
// injeção em todos os módulos sem que cada um precise importar o PrismaModule.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
