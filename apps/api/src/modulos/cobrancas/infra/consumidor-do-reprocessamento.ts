import { Injectable } from '@nestjs/common';
import { AgendadorDeRotinas, ROTINA_REPROCESSAR_EVENTOS } from '../../../compartilhado/fila/agendador-de-rotinas.js';
import { ReenfileirarEventosParados } from '../aplicacao/reenfileirar-eventos-parados.js';

// A cada 15 minutos: um pagamento parado espera no máximo isso (mais a idade mínima) para ser retomado.
const A_CADA_15_MINUTOS = '*/15 * * * *';

// Liga a rotina de reprocessamento ao caso de uso. Só o worker chama `iniciar()` (main-worker.ts).
@Injectable()
export class ConsumidorDoReprocessamento {
  constructor(
    private readonly agendador: AgendadorDeRotinas,
    private readonly reenfileirar: ReenfileirarEventosParados,
  ) {}

  async iniciar(): Promise<void> {
    await this.agendador.agendar(ROTINA_REPROCESSAR_EVENTOS, A_CADA_15_MINUTOS);
    await this.agendador.consumir(ROTINA_REPROCESSAR_EVENTOS, async () => {
      await this.reenfileirar.executar();
    });
  }
}
