// Ponto de entrada público do módulo Cobranças (ADR-0003, regra B1).
// Outros módulos, o app.module e o worker só importam daqui, nunca de arquivos internos.
export { CobrancasModule } from './cobrancas.module.js';
// O worker liga este consumidor ao iniciar (main-worker.ts).
export { ConsumidorDeEventosWebhook } from './infra/consumidor-de-eventos-webhook.js';
// O worker também liga a rotina da geração recorrente.
export { ConsumidorDaGeracaoRecorrente } from './infra/consumidor-da-geracao-recorrente.js';
// O worker liga a atualização do cliente no Asaas (reação ao evento "aluno alterado").
export { ReacaoAAlunoAlterado } from './infra/reacao-a-aluno-alterado.js';
// E a rotina que retoma eventos gravados e não processados (ADR-0002).
export { ConsumidorDoReprocessamento } from './infra/consumidor-do-reprocessamento.js';
// E a sincronização diária com o Asaas [Cobranças.RF007].
export { ConsumidorDaSincronizacao } from './infra/consumidor-da-sincronizacao.js';
// E a vigilância do webhook parado, que avisa a diretoria por e-mail [Confiabilidade.NF002].
export { ConsumidorDaVigilancia } from './infra/consumidor-da-vigilancia.js';
