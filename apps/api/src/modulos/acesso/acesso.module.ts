import { Module } from '@nestjs/common';
import { AutenticacaoController } from './api/autenticacao.controller.js';
import { Autenticar } from './aplicacao/autenticar.js';
import { EncerrarSessao } from './aplicacao/encerrar-sessao.js';

@Module({
  controllers: [AutenticacaoController],
  providers: [Autenticar, EncerrarSessao],
})
export class AcessoModule {}
