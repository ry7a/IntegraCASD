import { AgendadorDeRotinasFalso } from '../../../compartilhado/fila/agendador-de-rotinas.falso.js';
import { ROTINA_REPROCESSAR_EVENTOS } from '../../../compartilhado/fila/agendador-de-rotinas.js';
import { FilaDeEventosFalsa } from '../../../compartilhado/fila/fila-de-eventos.falsa.js';
import type { EventosWebhookRepositorio } from '../infra/eventos-webhook.repositorio.js';
import { ConsumidorDoReprocessamento } from '../infra/consumidor-do-reprocessamento.js';
import { LIMITE_POR_EXECUCAO, ReenfileirarEventosParados } from './reenfileirar-eventos-parados.js';

// Dublê do repositório: devolve os ids combinados e guarda com que corte foi consultado.
function repositorio(ids: string[]) {
  const consultas: Array<{ antesDe: Date; limite: number }> = [];
  const falso = {
    listarNaoProcessados: async (antesDe: Date, limite: number) => {
      consultas.push({ antesDe, limite });
      return ids;
    },
  } as unknown as EventosWebhookRepositorio;
  return { falso, consultas };
}

describe('reprocessar eventos gravados e não processados (ADR-0002)', () => {
  it('reenfileira só os eventos parados há mais de 5 minutos', async () => {
    const { falso, consultas } = repositorio(['uuid-1', 'uuid-2']);
    const fila = new FilaDeEventosFalsa();
    const agora = new Date('2026-10-26T12:00:00Z');

    const resultado = await new ReenfileirarEventosParados(falso, fila).executar(agora);

    expect(resultado).toEqual({ encontrados: 2, reenfileirados: 2, falhas: 0 });
    expect(fila.enfileirados).toEqual(['uuid-1', 'uuid-2']);
    expect(consultas).toEqual([{ antesDe: new Date('2026-10-26T11:55:00Z'), limite: LIMITE_POR_EXECUCAO }]);
  });

  it('com a fila fora do ar, conta as falhas sem interromper a rotina', async () => {
    const { falso } = repositorio(['uuid-1']);
    const fila = new FilaDeEventosFalsa();
    fila.indisponivel = true;

    await expect(new ReenfileirarEventosParados(falso, fila).executar()).resolves.toEqual({
      encontrados: 1,
      reenfileirados: 0,
      falhas: 1,
    });
  });

  it('o worker agenda a rotina a cada 15 minutos e a executa quando disparada', async () => {
    const { falso } = repositorio(['uuid-9']);
    const fila = new FilaDeEventosFalsa();
    const agendador = new AgendadorDeRotinasFalso();
    await new ConsumidorDoReprocessamento(agendador, new ReenfileirarEventosParados(falso, fila)).iniciar();

    expect(agendador.agendadas).toEqual([{ rotina: ROTINA_REPROCESSAR_EVENTOS, cron: '*/15 * * * *' }]);
    await agendador.disparar(ROTINA_REPROCESSAR_EVENTOS);
    expect(fila.enfileirados).toEqual(['uuid-9']);
  });
});
