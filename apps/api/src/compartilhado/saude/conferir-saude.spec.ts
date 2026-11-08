import { describe, expect, it } from 'vitest';
import { AgendadorDeRotinasFalso } from '../fila/agendador-de-rotinas.falso.js';
import { ROTINA_VIGILANCIA_DO_ASAAS } from '../fila/agendador-de-rotinas.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ConferirSaude } from './conferir-saude.js';

const AGORA = new Date('2026-11-08T12:00:00Z');

// Prisma falso: só o $queryRaw do "SELECT 1", que responde ou falha conforme o teste pede.
function prismaFalso(responde: boolean): PrismaService {
  return {
    $queryRaw: () => (responde ? Promise.resolve([{ '?column?': 1 }]) : Promise.reject(new Error('conexão recusada'))),
  } as unknown as PrismaService;
}

describe('ConferirSaude', () => {
  it('básica: 200 com o banco no ar, sem olhar o worker', async () => {
    const agendador = new AgendadorDeRotinasFalso();
    agendador.indisponivel = true; // nem consulta a fila
    const resposta = await new ConferirSaude(prismaFalso(true), agendador).basica();
    expect(resposta.status).toBe(200);
  });

  it('básica: 503 sem expor a mensagem do erro do banco', async () => {
    const resposta = await new ConferirSaude(prismaFalso(false), new AgendadorDeRotinasFalso()).basica();
    expect(resposta.status).toBe(503);
    expect(JSON.stringify(resposta.corpo)).not.toContain('conexão recusada');
  });

  it('completa: 200 quando a vigilância do Asaas concluiu há 20 minutos', async () => {
    const agendador = new AgendadorDeRotinasFalso();
    agendador.concluidasEm.set(ROTINA_VIGILANCIA_DO_ASAAS, new Date(AGORA.getTime() - 20 * 60 * 1000));
    const resposta = await new ConferirSaude(prismaFalso(true), agendador).completa(AGORA);
    expect(resposta).toEqual({ status: 200, corpo: { situacao: 'OK', banco: 'OK', vigilancia: 'EM_DIA' } });
  });

  it('completa: 503 quando a vigilância nunca rodou (worker desligado)', async () => {
    const resposta = await new ConferirSaude(prismaFalso(true), new AgendadorDeRotinasFalso()).completa(AGORA);
    expect(resposta.corpo.vigilancia).toBe('NUNCA_EXECUTOU');
    expect(resposta.status).toBe(503);
  });

  it('completa: 503 (e não exceção) quando a fila não responde', async () => {
    const agendador = new AgendadorDeRotinasFalso();
    agendador.indisponivel = true;
    const resposta = await new ConferirSaude(prismaFalso(true), agendador).completa(AGORA);
    expect(resposta).toEqual({ status: 503, corpo: { situacao: 'FALHA', banco: 'OK', vigilancia: 'DESCONHECIDA' } });
  });
});
