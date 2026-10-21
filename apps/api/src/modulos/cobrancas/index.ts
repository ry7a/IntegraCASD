// Ponto de entrada público do módulo Cobranças (ADR-0003, regra B1).
// Outros módulos, o app.module e o worker só importam daqui, nunca de arquivos internos.
export { CobrancasModule } from './cobrancas.module.js';
// O worker liga este consumidor ao iniciar (main-worker.ts).
export { ConsumidorDeEventosWebhook } from './infra/consumidor-de-eventos-webhook.js';
