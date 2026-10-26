import { Module } from '@nestjs/common';
import { MovimentacoesController } from './api/movimentacoes.controller.js';
import { ConsultarMovimentacoes } from './aplicacao/consultar-movimentacoes.js';
import { EstornarMovimentacao } from './aplicacao/estornar-movimentacao.js';
import { ListarOpcoesDaMovimentacao } from './aplicacao/listar-opcoes.js';
import { RegistrarMovimentacao } from './aplicacao/registrar-movimentacao.js';
import { TotaisPorVinculo } from './aplicacao/totais-por-vinculo.js';
import { MovimentacoesRepositorio } from './infra/movimentacoes.repositorio.js';

// Módulo Movimentações: entradas e saídas do CASD [Movimentações.RF001 a RF003]. As movimentações de
// cobrança são criadas pelo módulo de Cobranças, na transação da baixa; aqui elas só são consultadas.
@Module({
  controllers: [MovimentacoesController],
  providers: [
    MovimentacoesRepositorio,
    ConsultarMovimentacoes,
    ListarOpcoesDaMovimentacao,
    RegistrarMovimentacao,
    EstornarMovimentacao,
    TotaisPorVinculo,
  ],
  // O que outros módulos usam (Cadastros: total pago por contrato e movimentado por projeto).
  exports: [TotaisPorVinculo],
})
export class MovimentacoesModule {}
