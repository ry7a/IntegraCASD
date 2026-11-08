import { AgendadorDeRotinas, type DadosDaRotina } from './agendador-de-rotinas.js';

// Dublê de teste: não agenda nada de verdade, só guarda os pedidos para o teste conferir.
export class AgendadorDeRotinasFalso extends AgendadorDeRotinas {
  readonly agendadas: Array<{ rotina: string; cron: string }> = [];
  readonly pedidasAgora: Array<{ rotina: string; dados?: DadosDaRotina }> = [];
  readonly pedidasDepois: Array<{ rotina: string; segundos: number; dados?: DadosDaRotina }> = [];
  // O teste preenche para simular a última execução concluída de cada rotina.
  readonly concluidasEm = new Map<string, Date>();
  // Ligue para simular a fila fora do ar na consulta das execuções.
  indisponivel = false;
  // Quantas vezes ultimaExecucaoConcluida foi chamada (o teste do cache da saúde confere).
  consultasDaUltimaExecucao = 0;
  private readonly executores = new Map<string, (dados: DadosDaRotina) => Promise<void>>();

  ultimaExecucaoConcluida(rotina: string): Promise<Date | null> {
    this.consultasDaUltimaExecucao++;
    if (this.indisponivel) return Promise.reject(new Error('Fila indisponível.'));
    return Promise.resolve(this.concluidasEm.get(rotina) ?? null);
  }

  agendar(rotina: string, cron: string): Promise<void> {
    this.agendadas.push({ rotina, cron });
    return Promise.resolve();
  }

  executarAgora(rotina: string, dados?: DadosDaRotina): Promise<void> {
    this.pedidasAgora.push({ rotina, dados });
    return Promise.resolve();
  }

  executarDepois(rotina: string, segundos: number, dados?: DadosDaRotina): Promise<void> {
    this.pedidasDepois.push({ rotina, segundos, dados });
    return Promise.resolve();
  }

  consumir(rotina: string, executar: (dados: DadosDaRotina) => Promise<void>): Promise<void> {
    this.executores.set(rotina, executar);
    return Promise.resolve();
  }

  // Faz o papel do pg-boss disparando a rotina registrada.
  async disparar(rotina: string, dados: DadosDaRotina = {}): Promise<void> {
    const executar = this.executores.get(rotina);
    if (executar === undefined) throw new Error(`Nenhum executor registrado para ${rotina}.`);
    await executar(dados);
  }
}
