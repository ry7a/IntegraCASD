import { Injectable, Logger } from '@nestjs/common';
import { EventosWebhookRepositorio } from '../infra/eventos-webhook.repositorio.js';

// Caso de uso do worker: processa um evento que o webhook gravou e enfileirou.
// POR ENQUANTO só registra que o evento chegou ao worker. A baixa da cobrança (marcar como
// paga + criar a movimentação, na mesma transação) vem numa tarefa futura, e é nela que o
// evento passa a ser marcado como processado.
@Injectable()
export class ProcessarEventoWebhook {
  private readonly logger = new Logger(ProcessarEventoWebhook.name);

  constructor(private readonly eventos: EventosWebhookRepositorio) {}

  async executar(eventoId: string): Promise<'registrado' | 'ja-processado'> {
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

    // No log vão só o id e o tipo; o payload pode ter dados pessoais e fica só no banco.
    this.logger.log(`Worker recebeu o evento ${evento.idAsaas} (${evento.tipo}).`);
    return 'registrado';
  }
}
