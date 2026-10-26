import { Module } from '@nestjs/common';
import { MovimentacoesController } from './api/movimentacoes.controller.js';
import { ConsultarMovimentacoes } from './aplicacao/consultar-movimentacoes.js';
import { ListarOpcoesDaMovimentacao } from './aplicacao/listar-opcoes.js';
import { MovimentacoesRepositorio } from './infra/movimentacoes.repositorio.js';

// Módulo Movimentações: entradas e saídas do CASD [Movimentações.RF001 a RF003]. As movimentações de
// cobrança são criadas pelo módulo de Cobranças, na transação da baixa; aqui elas só são consultadas.
@Module({
  controllers: [MovimentacoesController],
  providers: [MovimentacoesRepositorio, ConsultarMovimentacoes, ListarOpcoesDaMovimentacao],
})
export class MovimentacoesModule {}
