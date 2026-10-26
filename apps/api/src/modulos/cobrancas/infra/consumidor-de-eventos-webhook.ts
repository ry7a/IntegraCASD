import { Injectable, Logger } from '@nestjs/common';
import { FilaDeEventos } from '../../../compartilhado/fila/fila-de-eventos.js';
import { ProcessarEventoWebhook } from '../aplicacao/processar-evento-webhook.js';

// Liga a fila ao caso de uso. Só o worker chama `iniciar()` (no main-worker.ts); a API
// nunca consome a fila, só enfileira.
@Injectable()
export class ConsumidorDeEventosWebhook {
  private readonly logger = new Logger(ConsumidorDeEventosWebhook.name);

  constructor(
    private readonly fila: FilaDeEventos,
    private readonly processarEventoWebhook: ProcessarEventoWebhook,
  ) {}

  async iniciar(): Promise<void> {
    await this.fila.consumir(async (eventoId) => {
      try {
        await this.processarEventoWebhook.executar(eventoId);
      } catch (erro) {
        // O pg-boss guarda o erro sem mostrar; o aviso no log é o que a equipe vê. Só a mensagem
        // (nunca o payload, que tem dados pessoais). O erro segue para a fila tentar de novo.
        this.logger.warn(`Evento ${eventoId} não processado; nova tentativa mais tarde. ${erro instanceof Error ? erro.message : ''}`);
        throw erro;
      }
    });
  }
}
