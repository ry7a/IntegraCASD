import { Module } from '@nestjs/common';
import { AsaasModule } from '../../compartilhado/asaas/asaas.module.js';
import { FilaModule } from '../../compartilhado/fila/fila.module.js';
import { AdministracaoModule } from '../administracao/index.js';
import { CadastrosModule } from '../cadastros/index.js';
import { CobrancasController } from './api/cobrancas.controller.js';
import { WebhookAsaasController } from './api/webhook-asaas.controller.js';
import { ConsultarCobrancas } from './aplicacao/consultar-cobrancas.js';
import { DetalharCobranca } from './aplicacao/detalhar-cobranca.js';
import { EmitirCobrancaAvulsa } from './aplicacao/emitir-cobranca-avulsa.js';
import { GarantirClienteAsaas } from './aplicacao/garantir-cliente-asaas.js';
import { ProcessarEventoWebhook } from './aplicacao/processar-evento-webhook.js';
import { ReceberEventoWebhook } from './aplicacao/receber-evento-webhook.js';
import { ResumirCobrancas } from './aplicacao/resumir-cobrancas.js';
import { SugerirNovaCobranca } from './aplicacao/sugerir-nova-cobranca.js';
import { CobrancasRepositorio } from './infra/cobrancas.repositorio.js';
import { ConsumidorDeEventosWebhook } from './infra/consumidor-de-eventos-webhook.js';
import { EventosWebhookRepositorio } from './infra/eventos-webhook.repositorio.js';

// Módulo Cobranças: emissão no Asaas, consulta e webhook (recebimento na API e consumo no worker).
// Exporta o consumidor, que o worker precisa ligar ao iniciar.
@Module({
  imports: [FilaModule, AsaasModule, CadastrosModule, AdministracaoModule],
  controllers: [CobrancasController, WebhookAsaasController],
  providers: [
    ReceberEventoWebhook,
    ProcessarEventoWebhook,
    EventosWebhookRepositorio,
    ConsumidorDeEventosWebhook,
    CobrancasRepositorio,
    GarantirClienteAsaas,
    EmitirCobrancaAvulsa,
    SugerirNovaCobranca,
    ConsultarCobrancas,
    ResumirCobrancas,
    DetalharCobranca,
  ],
  exports: [ConsumidorDeEventosWebhook],
})
export class CobrancasModule {}
