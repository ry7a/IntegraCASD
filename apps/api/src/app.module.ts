import { Module } from '@nestjs/common';
import { EventosInternosModule } from './compartilhado/eventos/eventos-internos.js';
import { PrismaModule } from './compartilhado/prisma/prisma.module.js';
import { AutenticacaoModule } from './compartilhado/autenticacao/autenticacao.module.js';
import { SaudeModule } from './compartilhado/saude/saude.module.js';
import { AcessoModule } from './modulos/acesso/index.js';
import { AdministracaoModule } from './modulos/administracao/index.js';
import { CadastrosModule } from './modulos/cadastros/index.js';
import { CobrancasModule } from './modulos/cobrancas/index.js';
import { IndicadoresModule } from './modulos/indicadores/index.js';
import { MovimentacoesModule } from './modulos/movimentacoes/index.js';

@Module({
  imports: [
    PrismaModule,
    EventosInternosModule,
    AutenticacaoModule,
    SaudeModule,
    AcessoModule,
    AdministracaoModule,
    CadastrosModule,
    CobrancasModule,
    MovimentacoesModule,
    IndicadoresModule,
  ],
})
export class AppModule {}
