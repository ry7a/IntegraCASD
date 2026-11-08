import { Injectable } from '@nestjs/common';
import { AgendadorDeRotinas, type DadosDaRotina } from './agendador-de-rotinas.js';
import { PgBossService, SCHEMA_DO_PGBOSS } from './pg-boss.service.js';

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
    // Uma consulta só, que devolve uma linha: a maior data de conclusão entre os jobs concluídos da
    // rotina. Chamada a cada GET /api/saude/completa, por isso não traz os jobs (nem depende da ordem ou de
    // um limite, como o findJobs, que lista do mais antigo para o mais novo). getDb() é a API pública do
    // pg-boss para rodar SQL na conexão dele; a tabela `job` e as colunas são as do schema do pg-boss 12.
    const { rows } = await this.pgBoss.boss.getDb().executeSql(SQL_ULTIMA_CONCLUSAO, [rotina]);
    return lerUltimaConclusao(rows);
  }
}

// O estado é conferido porque o pg-boss também preenche completed_on em job que falhou ou foi cancelado.
// Há um índice do próprio pg-boss em (name, completed_on), por isso a consulta é barata.
export const SQL_ULTIMA_CONCLUSAO = `SELECT max(completed_on) AS ultima FROM ${SCHEMA_DO_PGBOSS}.job WHERE name = $1 AND state = 'completed'`;

// Converte a linha devolvida pelo banco. O driver do PostgreSQL entrega timestamptz como Date, mas aceitar
// texto também não custa; sem nenhum job concluído, max() devolve uma linha com null.
export function lerUltimaConclusao(linhas: Array<{ ultima?: unknown }>): Date | null {
  const valor = linhas[0]?.ultima;
  if (valor === null || valor === undefined) return null;
  if (!(valor instanceof Date) && typeof valor !== 'string') return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}
