import { describe, expect, it } from 'vitest';
import { AgendadorDeRotinasPgBoss, SQL_ULTIMA_CONCLUSAO, lerUltimaConclusao } from './agendador-de-rotinas.pgboss.js';
import type { PgBossService } from './pg-boss.service.js';

// pg-boss falso: só o getDb().executeSql, que anota a consulta e devolve as linhas que o teste pedir.
function pgBossFalso(linhas: Array<{ ultima?: unknown }>) {
  const consultas: Array<{ sql: string; valores?: unknown[] }> = [];
  const servico = {
    boss: {
      getDb: () => ({
        executeSql: (sql: string, valores?: unknown[]) => {
          consultas.push({ sql, valores });
          return Promise.resolve({ rows: linhas });
        },
      }),
    },
  } as unknown as PgBossService;
  return { servico, consultas };
}

describe('AgendadorDeRotinasPgBoss.ultimaExecucaoConcluida', () => {
  it('faz uma consulta só, o max(completed_on) dos jobs concluídos daquela rotina', async () => {
    const concluidaEm = new Date('2026-11-08T11:30:00Z');
    const { servico, consultas } = pgBossFalso([{ ultima: concluidaEm }]);

    const ultima = await new AgendadorDeRotinasPgBoss(servico).ultimaExecucaoConcluida('vigilancia-do-asaas');

    expect(ultima).toEqual(concluidaEm);
    expect(consultas).toEqual([{ sql: SQL_ULTIMA_CONCLUSAO, valores: ['vigilancia-do-asaas'] }]);
  });

  it('a consulta agrega no banco (não lista jobs) e ignora os que falharam ou foram cancelados', () => {
    expect(SQL_ULTIMA_CONCLUSAO).toContain('max(completed_on)');
    expect(SQL_ULTIMA_CONCLUSAO).toContain('FROM pgboss.job');
    expect(SQL_ULTIMA_CONCLUSAO).toContain('name = $1');
    expect(SQL_ULTIMA_CONCLUSAO).toContain("state = 'completed'");
    expect(SQL_ULTIMA_CONCLUSAO).not.toMatch(/LIMIT|ORDER BY/i);
  });

  it('sem nenhum job concluído, devolve null', async () => {
    const { servico } = pgBossFalso([{ ultima: null }]);
    expect(await new AgendadorDeRotinasPgBoss(servico).ultimaExecucaoConcluida('vigilancia-do-asaas')).toBeNull();
  });
});

describe('lerUltimaConclusao', () => {
  it('aceita Date e texto ISO', () => {
    const data = new Date('2026-11-08T11:30:00Z');
    expect(lerUltimaConclusao([{ ultima: data }])).toEqual(data);
    expect(lerUltimaConclusao([{ ultima: '2026-11-08T11:30:00.000Z' }])).toEqual(data);
  });

  it('null, linha vazia ou valor inválido viram null', () => {
    expect(lerUltimaConclusao([])).toBeNull();
    expect(lerUltimaConclusao([{ ultima: null }])).toBeNull();
    expect(lerUltimaConclusao([{}])).toBeNull();
    expect(lerUltimaConclusao([{ ultima: 'não é data' }])).toBeNull();
    expect(lerUltimaConclusao([{ ultima: 42 }])).toBeNull();
  });
});
