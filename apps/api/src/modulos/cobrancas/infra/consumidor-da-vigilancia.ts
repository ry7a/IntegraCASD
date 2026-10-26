import { Injectable, Logger } from '@nestjs/common';
import { AgendadorDeRotinas, ROTINA_VIGILANCIA_DO_ASAAS } from '../../../compartilhado/fila/agendador-de-rotinas.js';
import { VerificarSilencioDoAsaas } from '../aplicacao/verificar-silencio-do-asaas.js';

// A cada 30 minutos: o menor prazo do alerta é de 12 horas, então meia hora de atraso na detecção não pesa.
const A_CADA_30_MINUTOS = '*/30 * * * *';

// [Confiabilidade.NF002] Rotina de vigilância do webhook. Só o worker chama `iniciar()` (main-worker.ts).
// O resultado de cada verificação vai para o log: o estado completo fica na tabela de alertas e na trilha.
@Injectable()
export class ConsumidorDaVigilancia {
  private readonly logger = new Logger(ConsumidorDaVigilancia.name);

  constructor(
    private readonly agendador: AgendadorDeRotinas,
    private readonly verificar: VerificarSilencioDoAsaas,
  ) {}

  async iniciar(): Promise<void> {
    await this.agendador.agendar(ROTINA_VIGILANCIA_DO_ASAAS, A_CADA_30_MINUTOS);
    await this.agendador.consumir(ROTINA_VIGILANCIA_DO_ASAAS, async () => {
      const resultado = await this.verificar.executar();
      if (resultado.situacao !== 'MEDIDO') {
        this.logger.log(`Vigilância do Asaas: ${resultado.situacao === 'SEM_INTEGRACAO' ? 'integração não configurada' : 'sem referência de tempo'}; nada a medir.`);
        return;
      }
      const medida = `${resultado.horasSemNotificacao} h sem notificações (prazo de ${resultado.prazoHoras} h)`;
      if (resultado.envio === null) {
        this.logger.log(`Vigilância do Asaas: ${medida}; ação: ${resultado.acao}.`);
      } else if (resultado.envio.enviado) {
        this.logger.warn(`Vigilância do Asaas: ${medida}; alerta enviado a ${resultado.envio.destinatarios} destinatário(s) (${resultado.acao}).`);
      } else {
        // O e-mail não saiu: a próxima verificação (30 minutos) tenta de novo.
        this.logger.error(`Vigilância do Asaas: ${medida}; ALERTA NÃO ENVIADO. ${resultado.envio.motivo}`);
      }
    });
  }
}
