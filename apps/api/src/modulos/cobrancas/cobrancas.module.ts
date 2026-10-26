import { Module } from '@nestjs/common';
import { AsaasModule } from '../../compartilhado/asaas/asaas.module.js';
import { FilaModule } from '../../compartilhado/fila/fila.module.js';
import { AdministracaoModule } from '../administracao/index.js';
import { CadastrosModule } from '../cadastros/index.js';
import { CobrancasController } from './api/cobrancas.controller.js';
import { GeracaoRecorrenteController } from './api/geracao-recorrente.controller.js';
import { WebhookAsaasController } from './api/webhook-asaas.controller.js';
import { CancelarCobranca } from './aplicacao/cancelar-cobranca.js';
import { ConsultarCobrancas } from './aplicacao/consultar-cobrancas.js';
import { DetalharCobranca } from './aplicacao/detalhar-cobranca.js';
import { EmitirCobrancaAvulsa } from './aplicacao/emitir-cobranca-avulsa.js';
import { GarantirClienteAsaas } from './aplicacao/garantir-cliente-asaas.js';
import { ObterBoleto } from './aplicacao/obter-boleto.js';
import { GerarCobrancasRecorrentes } from './aplicacao/gerar-cobrancas-recorrentes.js';
import { ListarExecucoesDaGeracao } from './aplicacao/listar-execucoes-da-geracao.js';
import { PedirGeracaoAgora } from './aplicacao/pedir-geracao-agora.js';
import { ProcessarEventoWebhook } from './aplicacao/processar-evento-webhook.js';
import { ReceberEventoWebhook } from './aplicacao/receber-evento-webhook.js';
import { ResumirCobrancas } from './aplicacao/resumir-cobrancas.js';
import { SugerirNovaCobranca } from './aplicacao/sugerir-nova-cobranca.js';
import { CobrancasRepositorio } from './infra/cobrancas.repositorio.js';
import { ConsumidorDaGeracaoRecorrente } from './infra/consumidor-da-geracao-recorrente.js';
import { ConsumidorDeEventosWebhook } from './infra/consumidor-de-eventos-webhook.js';
import { EventosWebhookRepositorio } from './infra/eventos-webhook.repositorio.js';
import { ExecucoesRepositorio } from './infra/execucoes.repositorio.js';
import { RitmoDoAsaas } from './infra/ritmo-do-asaas.js';

// Módulo Cobranças: emissão no Asaas, consulta, geração recorrente e webhook. Exporta os
// consumidores (webhook e geração recorrente), que o worker liga ao iniciar.
@Module({
  imports: [FilaModule, AsaasModule, CadastrosModule, AdministracaoModule],
  controllers: [CobrancasController, GeracaoRecorrenteController, WebhookAsaasController],
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
    ObterBoleto,
    CancelarCobranca,
    ExecucoesRepositorio,
    RitmoDoAsaas,
    GerarCobrancasRecorrentes,
    PedirGeracaoAgora,
    ListarExecucoesDaGeracao,
    ConsumidorDaGeracaoRecorrente,
  ],
  exports: [ConsumidorDeEventosWebhook, ConsumidorDaGeracaoRecorrente],
})
export class CobrancasModule {}
