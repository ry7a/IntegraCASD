import { Module } from '@nestjs/common';
import { FilaModule } from '../../compartilhado/fila/fila.module.js';
import { WebhookAsaasController } from './api/webhook-asaas.controller.js';
import { ProcessarEventoWebhook } from './aplicacao/processar-evento-webhook.js';
import { ReceberEventoWebhook } from './aplicacao/receber-evento-webhook.js';
import { ConsumidorDeEventosWebhook } from './infra/consumidor-de-eventos-webhook.js';
import { EventosWebhookRepositorio } from './infra/eventos-webhook.repositorio.js';

// Módulo Cobranças: por enquanto, só o webhook do Asaas (recebimento na API e consumo no worker).
// Exporta apenas o consumidor, que o worker precisa ligar ao iniciar.
@Module({
  imports: [FilaModule],
  controllers: [WebhookAsaasController],
  providers: [
    ReceberEventoWebhook,
    ProcessarEventoWebhook,
    EventosWebhookRepositorio,
    ConsumidorDeEventosWebhook,
  ],
  exports: [ConsumidorDeEventosWebhook],
})
export class CobrancasModule {}
