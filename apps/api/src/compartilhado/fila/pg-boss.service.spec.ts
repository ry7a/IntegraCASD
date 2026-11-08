import { describe, expect, it } from 'vitest';
import { opcoesDoPgBoss } from './pg-boss.service.js';

const URL_FICTICIA = 'postgresql://ficticio:ficticio@localhost:5434/ficticio';

describe('opcoesDoPgBoss', () => {
  it('a API não roda agendamento (cron) nem supervisão, mas migra o schema para poder enfileirar', () => {
    expect(opcoesDoPgBoss(URL_FICTICIA, 'api')).toEqual({
      connectionString: URL_FICTICIA,
      schema: 'pgboss',
      schedule: false,
      supervise: false,
      migrate: true,
    });
  });

  it('o worker roda o agendamento e a supervisão', () => {
    const opcoes = opcoesDoPgBoss(URL_FICTICIA, 'worker');
    expect(opcoes.schedule).toBe(true);
    expect(opcoes.supervise).toBe(true);
    expect(opcoes.migrate).toBe(true);
  });
});
