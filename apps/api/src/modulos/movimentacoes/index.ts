// Ponto de entrada público do módulo Movimentações (ADR-0003, regra B1).
// Outros módulos e o app.module só importam daqui, nunca de arquivos internos.
export { MovimentacoesModule } from './movimentacoes.module.js';
export { TotaisPorVinculo } from './aplicacao/totais-por-vinculo.js';
