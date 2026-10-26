import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { EventosInternosModule } from './compartilhado/eventos/eventos-internos.js';
import { PrismaModule } from './compartilhado/prisma/prisma.module.js';
import { AutenticacaoModule } from './compartilhado/autenticacao/autenticacao.module.js';
import { AcessoModule } from './modulos/acesso/index.js';
import { AdministracaoModule } from './modulos/administracao/index.js';
import { CadastrosModule } from './modulos/cadastros/index.js';
import { CobrancasModule } from './modulos/cobrancas/index.js';
import { IndicadoresModule } from './modulos/indicadores/index.js';
import { MovimentacoesModule } from './modulos/movimentacoes/index.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'api',
    }),
    PrismaModule,
    EventosInternosModule,
    AutenticacaoModule,
    AcessoModule,
    AdministracaoModule,
    CadastrosModule,
    CobrancasModule,
    MovimentacoesModule,
    IndicadoresModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
