import { Injectable } from '@nestjs/common';
import { AgendadorDeRotinas, ROTINA_GERACAO_RECORRENTE } from '../../../compartilhado/fila/agendador-de-rotinas.js';
import { GerarCobrancasRecorrentes } from '../aplicacao/gerar-cobrancas-recorrentes.js';

// Todo dia às 6h (São Paulo). A rotina decide se há o que gerar (dia de geração, mês ainda não gerado).
const TODO_DIA_AS_6H = '0 6 * * *';

// Liga a rotina da geração recorrente ao caso de uso. Só o worker chama `iniciar()` (main-worker.ts).
@Injectable()
export class ConsumidorDaGeracaoRecorrente {
  constructor(
    private readonly agendador: AgendadorDeRotinas,
    private readonly gerarCobrancasRecorrentes: GerarCobrancasRecorrentes,
  ) {}

  async iniciar(): Promise<void> {
    await this.agendador.agendar(ROTINA_GERACAO_RECORRENTE, TODO_DIA_AS_6H);
    await this.agendador.consumir(ROTINA_GERACAO_RECORRENTE, async (dados) => {
      await this.gerarCobrancasRecorrentes.executar(dados.origem === 'MANUAL' ? 'MANUAL' : 'AGENDADA');
    });
  }
}
