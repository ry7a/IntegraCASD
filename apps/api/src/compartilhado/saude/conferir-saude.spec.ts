import { describe, expect, it } from 'vitest';
import { AgendadorDeRotinasFalso } from '../fila/agendador-de-rotinas.falso.js';
import { ROTINA_VIGILANCIA_DO_ASAAS } from '../fila/agendador-de-rotinas.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CACHE_DA_SAUDE_COMPLETA_MS, ConferirSaude } from './conferir-saude.js';

const AGORA = new Date('2026-11-08T12:00:00Z');

// Prisma falso: só o $queryRaw do "SELECT 1", que responde ou falha conforme o teste pede. `consultas`
// conta as chamadas (para o teste do cache).
function prismaFalso(responde: boolean, consultas = { total: 0 }): PrismaService {
  return {
    $queryRaw: () => {
      consultas.total++;
      return responde ? Promise.resolve([{ '?column?': 1 }]) : Promise.reject(new Error('conexão recusada'));
    },
  } as unknown as PrismaService;
}

const segundosDepois = (segundos: number) => new Date(AGORA.getTime() + segundos * 1000);

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

  it('completa: reaproveita a resposta por 30 s, sem consultar banco nem fila de novo', async () => {
    const agendador = new AgendadorDeRotinasFalso();
    agendador.concluidasEm.set(ROTINA_VIGILANCIA_DO_ASAAS, new Date(AGORA.getTime() - 20 * 60 * 1000));
    const consultas = { total: 0 };
    const conferir = new ConferirSaude(prismaFalso(true, consultas), agendador);

    const primeira = await conferir.completa(AGORA);
    agendador.concluidasEm.clear(); // se consultasse de novo, viraria 503
    const segunda = await conferir.completa(segundosDepois(29));

    expect(segunda).toEqual(primeira);
    expect(consultas.total).toBe(1);
    expect(agendador.consultasDaUltimaExecucao).toBe(1);
  });

  it('completa: passado o prazo do cache, confere de novo', async () => {
    const agendador = new AgendadorDeRotinasFalso();
    agendador.concluidasEm.set(ROTINA_VIGILANCIA_DO_ASAAS, new Date(AGORA.getTime() - 20 * 60 * 1000));
    const conferir = new ConferirSaude(prismaFalso(true), agendador);

    expect((await conferir.completa(AGORA)).status).toBe(200);
    agendador.concluidasEm.clear();
    const depois = await conferir.completa(new Date(AGORA.getTime() + CACHE_DA_SAUDE_COMPLETA_MS));

    expect(depois.status).toBe(503);
    expect(agendador.consultasDaUltimaExecucao).toBe(2);
  });

  it('completa: pedidos simultâneos esperam a mesma conferência', async () => {
    const agendador = new AgendadorDeRotinasFalso();
    const consultas = { total: 0 };
    const conferir = new ConferirSaude(prismaFalso(true, consultas), agendador);

    await Promise.all([conferir.completa(AGORA), conferir.completa(AGORA), conferir.completa(segundosDepois(1))]);

    expect(consultas.total).toBe(1);
    expect(agendador.consultasDaUltimaExecucao).toBe(1);
  });

  it('completa: se o relógio voltar, não confia no cache', async () => {
    const agendador = new AgendadorDeRotinasFalso();
    const conferir = new ConferirSaude(prismaFalso(true), agendador);

    await conferir.completa(AGORA);
    await conferir.completa(segundosDepois(-5));

    expect(agendador.consultasDaUltimaExecucao).toBe(2);
  });

  it('básica não usa cache (a Docker e a implantação precisam da situação de agora)', async () => {
    const consultas = { total: 0 };
    const conferir = new ConferirSaude(prismaFalso(true, consultas), new AgendadorDeRotinasFalso());
    await conferir.basica();
    await conferir.basica();
    expect(consultas.total).toBe(2);
  });
});
