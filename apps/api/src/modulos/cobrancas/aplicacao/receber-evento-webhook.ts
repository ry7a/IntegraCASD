import { Injectable } from '@nestjs/common';
import { FilaDeEventos } from '../../../compartilhado/fila/fila-de-eventos.js';
import { EventosWebhookRepositorio } from '../infra/eventos-webhook.repositorio.js';
import type { EventoRecebido } from '../infra/eventos-webhook.repositorio.js';

// O tipo da entrada faz parte do caso de uso: o controller importa daqui, sem conhecer a infra (B2).
export type { EventoRecebido };

// Caso de uso [Desempenho.NF001]: recebe um evento do webhook do Asaas. Não processa nada:
// só grava o evento e pede o processamento à fila. Quem processa é o worker.
@Injectable()
export class ReceberEventoWebhook {
  constructor(
    private readonly eventos: EventosWebhookRepositorio,
    private readonly fila: FilaDeEventos,
  ) {}

  async executar(recebido: EventoRecebido): Promise<void> {
    const { evento, novo } = await this.eventos.registrar(recebido);

    // Evento repetido que já foi processado: nada a fazer. [Confiabilidade.NF003]
    if (!novo && evento.processadoEm !== null) {
      return;
    }

    // Enfileira se o evento é novo OU se é repetido mas ainda não foi processado. O segundo
    // caso cobre uma falha entre gravar e enfileirar: o Asaas reenvia o evento, e é este
    // reenvio que recoloca o evento na fila. Enfileirar duas vezes é inofensivo, porque o
    // worker confere se o evento já foi processado.
    // Se a fila falhar, o erro sobe, o webhook responde erro e o Asaas tenta de novo.
    await this.fila.enfileirarProcessamento(evento.id);
  }
}
