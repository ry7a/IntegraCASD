import { Module } from '@nestjs/common';
import { AsaasModule } from '../../compartilhado/asaas/asaas.module.js';
import { FilaModule } from '../../compartilhado/fila/fila.module.js';
import { AdministracaoModule } from '../administracao/index.js';
import { CadastrosModule } from '../cadastros/index.js';
import { CobrancasController } from './api/cobrancas.controller.js';
import { GeracaoRecorrenteController } from './api/geracao-recorrente.controller.js';
import { PendenciasController } from './api/pendencias.controller.js';
import { WebhookAsaasController } from './api/webhook-asaas.controller.js';
import { AtualizarClienteAsaas } from './aplicacao/atualizar-cliente-asaas.js';
import { CancelarCobranca } from './aplicacao/cancelar-cobranca.js';
import { ConsultarCobrancas } from './aplicacao/consultar-cobrancas.js';
import { DetalharCobranca } from './aplicacao/detalhar-cobranca.js';
import { EmitirCobrancaAvulsa } from './aplicacao/emitir-cobranca-avulsa.js';
import { GarantirClienteAsaas } from './aplicacao/garantir-cliente-asaas.js';
import { ObterBoleto } from './aplicacao/obter-boleto.js';
import { GerarCobrancasRecorrentes } from './aplicacao/gerar-cobrancas-recorrentes.js';
import { ListarExecucoesDaGeracao } from './aplicacao/listar-execucoes-da-geracao.js';
import { ListarPendencias, ResolverPendencia } from './aplicacao/pendencias-de-conciliacao.js';
import { PedirGeracaoAgora } from './aplicacao/pedir-geracao-agora.js';
import { ProcessarEventoWebhook } from './aplicacao/processar-evento-webhook.js';
import { ReceberEventoWebhook } from './aplicacao/receber-evento-webhook.js';
import { RegistrarPagamentoManual } from './aplicacao/registrar-pagamento-manual.js';
import { ReenfileirarEventosParados } from './aplicacao/reenfileirar-eventos-parados.js';
import { ResumirCobrancas } from './aplicacao/resumir-cobrancas.js';
import { SincronizarCobrancas } from './aplicacao/sincronizar-cobrancas.js';
import { SugerirNovaCobranca } from './aplicacao/sugerir-nova-cobranca.js';
import { CobrancasRepositorio } from './infra/cobrancas.repositorio.js';
import { ConciliacaoRepositorio } from './infra/conciliacao.repositorio.js';
import { ConsumidorDaGeracaoRecorrente } from './infra/consumidor-da-geracao-recorrente.js';
import { ConsumidorDeEventosWebhook } from './infra/consumidor-de-eventos-webhook.js';
import { ConsumidorDoReprocessamento } from './infra/consumidor-do-reprocessamento.js';
import { ConsumidorDaSincronizacao } from './infra/consumidor-da-sincronizacao.js';
import { PendenciasRepositorio } from './infra/pendencias.repositorio.js';
import { SincronizacaoRepositorio } from './infra/sincronizacao.repositorio.js';
import { EventosWebhookRepositorio } from './infra/eventos-webhook.repositorio.js';
import { ExecucoesRepositorio } from './infra/execucoes.repositorio.js';
import { ReacaoAAlunoAlterado } from './infra/reacao-a-aluno-alterado.js';
import { RitmoDoAsaas } from './infra/ritmo-do-asaas.js';

// Módulo Cobranças: emissão no Asaas, consulta, geração recorrente e webhook. Exporta os
// consumidores (webhook e geração recorrente), que o worker liga ao iniciar.
@Module({
  imports: [FilaModule, AsaasModule, CadastrosModule, AdministracaoModule],
  controllers: [CobrancasController, GeracaoRecorrenteController, PendenciasController, WebhookAsaasController],
  providers: [
    ReceberEventoWebhook,
    ProcessarEventoWebhook,
    EventosWebhookRepositorio,
    ConciliacaoRepositorio,
    ConsumidorDeEventosWebhook,
    ReenfileirarEventosParados,
    ConsumidorDoReprocessamento,
    SincronizacaoRepositorio,
    PendenciasRepositorio,
    ListarPendencias,
    ResolverPendencia,
    SincronizarCobrancas,
    ConsumidorDaSincronizacao,
    CobrancasRepositorio,
    GarantirClienteAsaas,
    EmitirCobrancaAvulsa,
    SugerirNovaCobranca,
    ConsultarCobrancas,
    ResumirCobrancas,
    DetalharCobranca,
    ObterBoleto,
    CancelarCobranca,
    RegistrarPagamentoManual,
    ExecucoesRepositorio,
    RitmoDoAsaas,
    GerarCobrancasRecorrentes,
    PedirGeracaoAgora,
    ListarExecucoesDaGeracao,
    ConsumidorDaGeracaoRecorrente,
    AtualizarClienteAsaas,
    ReacaoAAlunoAlterado,
  ],
  exports: [ConsumidorDeEventosWebhook, ConsumidorDaGeracaoRecorrente, ReacaoAAlunoAlterado, ConsumidorDoReprocessamento, ConsumidorDaSincronizacao],
})
export class CobrancasModule {}
