import { Injectable } from '@nestjs/common';
import { AgendadorDeRotinas, type DadosDaRotina } from './agendador-de-rotinas.js';
import { PgBossService } from './pg-boss.service.js';

const FUSO = 'America/Sao_Paulo';

// Implementação real das rotinas, sobre o pg-boss. As filas das rotinas são criadas pelo
// PgBossService ao subir, com a política "singleton": no máximo uma execução da mesma rotina por vez
// (duas gerações ao mesmo tempo poderiam pedir ao Asaas a mesma mensalidade duas vezes).
@Injectable()
export class AgendadorDeRotinasPgBoss extends AgendadorDeRotinas {
  constructor(private readonly pgBoss: PgBossService) {
    super();
  }

  async agendar(rotina: string, cron: string): Promise<void> {
    await this.pgBoss.boss.schedule(rotina, cron, {}, { tz: FUSO });
  }

  async executarAgora(rotina: string, dados: DadosDaRotina = {}): Promise<void> {
    await this.pgBoss.boss.send(rotina, dados);
  }

  async executarDepois(rotina: string, segundos: number, dados: DadosDaRotina = {}): Promise<void> {
    await this.pgBoss.boss.sendAfter(rotina, dados, null, segundos);
  }

  async consumir(rotina: string, executar: (dados: DadosDaRotina) => Promise<void>): Promise<void> {
    // O pg-boss entrega em lote; cada job é executado em ordem. Se falhar, o erro sobe e o pg-boss
    // tenta de novo, por isso as rotinas precisam ser seguras para rodar duas vezes.
    await this.pgBoss.boss.work<DadosDaRotina>(rotina, async (jobs) => {
      for (const job of jobs) {
        await executar(job.data ?? {});
      }
    });
  }

  async ultimaExecucaoConcluida(rotina: string): Promise<Date | null> {
    // O pg-boss guarda cada execução como um job na própria tabela e só apaga os concluídos depois de
    // 7 dias (deleteAfterSeconds padrão). Uma rotina a cada 30 minutos deixa uns 340 jobs ali; o limite
    // abaixo cobre isso com folga. findJobs devolve do mais antigo para o mais novo, por isso o laço.
    const jobs = await this.pgBoss.boss.findJobs(rotina, { limit: 5000 });
    let ultima: Date | null = null;
    for (const job of jobs) {
      if (job.state === 'completed' && job.completedOn !== null) {
        const concluidaEm = new Date(job.completedOn);
        if (ultima === null || concluidaEm > ultima) ultima = concluidaEm;
      }
    }
    return ultima;
  }
}
