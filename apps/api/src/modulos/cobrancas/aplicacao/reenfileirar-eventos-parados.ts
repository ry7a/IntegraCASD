import { Injectable, Logger } from '@nestjs/common';
import { FilaDeEventos } from '../../../compartilhado/fila/fila-de-eventos.js';
import { EventosWebhookRepositorio } from '../infra/eventos-webhook.repositorio.js';

// Evento mais novo que isto ainda está no caminho normal (acabou de ser gravado e enfileirado).
export const IDADE_MINIMA_MINUTOS = 5;
// Por execução, para uma fila parada por muito tempo não virar uma avalanche de uma vez só.
export const LIMITE_POR_EXECUCAO = 500;

export type ResultadoDoReenfileiramento = { encontrados: number; reenfileirados: number; falhas: number };

// Rotina do ADR-0002: o webhook grava o evento e depois enfileira. Se o processo cair entre os dois
// passos, ou se a fila esgotar as tentativas, o evento fica gravado e sem processar. Esta rotina
// encontra esses eventos e os coloca de novo na fila. Rodar duas vezes é inofensivo: o worker
// confere se o evento já foi processado [Confiabilidade.NF003].
@Injectable()
export class ReenfileirarEventosParados {
  private readonly logger = new Logger(ReenfileirarEventosParados.name);

  constructor(
    private readonly eventos: EventosWebhookRepositorio,
    private readonly fila: FilaDeEventos,
  ) {}

  async executar(agora: Date = new Date()): Promise<ResultadoDoReenfileiramento> {
    const gravadosAntesDe = new Date(agora.getTime() - IDADE_MINIMA_MINUTOS * 60_000);
    const ids = await this.eventos.listarNaoProcessados(gravadosAntesDe, LIMITE_POR_EXECUCAO);
    let reenfileirados = 0;
    let falhas = 0;
    for (const id of ids) {
      try {
        await this.fila.enfileirarProcessamento(id);
        reenfileirados += 1;
      } catch {
        // Um evento que não entrou na fila não impede os outros; a próxima execução tenta de novo.
        falhas += 1;
      }
    }
    if (ids.length > 0) {
      this.logger.log(`Eventos sem processar: ${ids.length}; reenfileirados: ${reenfileirados}; falhas: ${falhas}.`);
    }
    return { encontrados: ids.length, reenfileirados, falhas };
  }
}
