import { Injectable, Logger } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { BuscarParametrosVigentes } from '../../administracao/index.js';
import { decidirConciliacao, lerAvisoDePagamento } from '../dominio/conciliacao.js';
import { ConciliacaoRepositorio, type DestinoDaBaixa } from '../infra/conciliacao.repositorio.js';
import { buscarDestinoDaBaixa } from './destino-da-baixa.js';
import { EventosWebhookRepositorio } from '../infra/eventos-webhook.repositorio.js';

// Sem conta ou categoria de recebimento não dá para criar a entrada. O evento fica sem processar:
// a fila tenta de novo e, depois de escolhidos os parâmetros, a baixa acontece.
export class DestinoDaBaixaNaoDefinido extends Error {
  constructor(origem: 'MENSALIDADE' | 'AVULSA') {
    super(
      `Pagamento recebido, mas falta escolher a conta de recebimento e a categoria das ${
        origem === 'MENSALIDADE' ? 'mensalidades' : 'cobranças avulsas'
      } em Administração > Parâmetros. A conciliação tenta de novo depois.`,
    );
  }
}

// Caso de uso do worker [Cobranças.RF005]: processa um evento que o webhook gravou e enfileirou.
// Lê o aviso, decide o efeito (regras em dominio/conciliacao.ts) e aplica tudo numa transação.
@Injectable()
export class ProcessarEventoWebhook {
  private readonly logger = new Logger(ProcessarEventoWebhook.name);

  constructor(
    private readonly eventos: EventosWebhookRepositorio,
    private readonly conciliacao: ConciliacaoRepositorio,
    private readonly parametros: BuscarParametrosVigentes,
  ) {}

  async executar(eventoId: string, hoje = hojeEmSaoPaulo()): Promise<'processado' | 'ja-processado'> {
    const evento = await this.eventos.buscarPorId(eventoId);

    // Não deveria acontecer (o evento é gravado antes de ser enfileirado). Se acontecer,
    // o erro faz a fila tentar de novo, em vez de descartar o job em silêncio.
    if (evento === null) {
      throw new Error(`Evento ${eventoId} não encontrado no banco.`);
    }

    // Idempotência: um evento já processado não é processado de novo. [Confiabilidade.NF003]
    if (evento.processadoEm !== null) {
      this.logger.log(`Evento ${evento.idAsaas} já processado; nada a fazer.`);
      return 'ja-processado';
    }

    const aviso = lerAvisoDePagamento(evento.tipo, evento.payload);
    const cobranca = aviso.idCobrancaAsaas === null ? null : await this.conciliacao.buscarCobranca(aviso.idCobrancaAsaas);
    const acao = decidirConciliacao(aviso, cobranca, hoje);
    const destino = acao.tipo === 'BAIXAR' && cobranca !== null ? await this.destinoDaBaixa(cobranca.origem) : null;

    const resultado = await this.conciliacao.aplicar(evento, cobranca, acao, destino);

    // No log vão só o id, o tipo e o efeito; o payload pode ter dados pessoais e fica só no banco.
    this.logger.log(`Evento ${evento.idAsaas} (${evento.tipo}): ${resultado === 'ja-processado' ? 'já processado' : acao.tipo}.`);
    return resultado === 'ja-processado' ? 'ja-processado' : 'processado';
  }

  private async destinoDaBaixa(origem: 'MENSALIDADE' | 'AVULSA'): Promise<DestinoDaBaixa> {
    const destino = await buscarDestinoDaBaixa(this.parametros, origem);
    if (destino === null) throw new DestinoDaBaixaNaoDefinido(origem);
    return destino;
  }
}
