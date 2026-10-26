import { Injectable, Logger } from '@nestjs/common';
import { ErroAsaas } from '../../../compartilhado/asaas/cliente-asaas.js';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { AgendadorDeRotinas, ROTINA_SINCRONIZACAO } from '../../../compartilhado/fila/agendador-de-rotinas.js';
import { SincronizarCobrancas } from '../aplicacao/sincronizar-cobrancas.js';
import { periodoDaRotinaDiaria } from '../dominio/sincronizacao.js';

// Todo dia às 5h (São Paulo), antes da geração recorrente das 6h.
const TODO_DIA_AS_5H = '0 5 * * *';

// [Cobranças.RF007] fluxo A2: sincronização automática diária. Só o worker chama `iniciar()`.
@Injectable()
export class ConsumidorDaSincronizacao {
  private readonly logger = new Logger(ConsumidorDaSincronizacao.name);

  constructor(
    private readonly agendador: AgendadorDeRotinas,
    private readonly sincronizar: SincronizarCobrancas,
  ) {}

  async iniciar(): Promise<void> {
    await this.agendador.agendar(ROTINA_SINCRONIZACAO, TODO_DIA_AS_5H);
    await this.agendador.consumir(ROTINA_SINCRONIZACAO, async () => {
      try {
        await this.sincronizar.periodo(periodoDaRotinaDiaria(hojeEmSaoPaulo()), 'AGENDADA', null);
      } catch (erro) {
        // Asaas fora do ar: a execução já ficou registrada com o motivo; amanhã roda de novo.
        if (!(erro instanceof ErroAsaas)) throw erro;
        this.logger.warn(`Sincronização diária interrompida: ${erro.message}`);
      }
    });
  }
}
