import { describe, expect, it } from 'vitest';
import { avaliarSaudeBasica, avaliarSaudeCompleta, situacaoDaVigilancia } from './saude.js';

const AGORA = new Date('2026-11-08T12:00:00Z');
const minutosAtras = (minutos: number) => new Date(AGORA.getTime() - minutos * 60 * 1000);

describe('avaliarSaudeBasica', () => {
  it('200 quando o banco responde', () => {
    expect(avaliarSaudeBasica(true)).toEqual({ status: 200, corpo: { situacao: 'OK', banco: 'OK' } });
  });

  it('503 quando o banco não responde', () => {
    expect(avaliarSaudeBasica(false)).toEqual({ status: 503, corpo: { situacao: 'FALHA', banco: 'FALHA' } });
  });
});

describe('situacaoDaVigilancia', () => {
  it('em dia até uma hora depois da última execução, inclusive', () => {
    expect(situacaoDaVigilancia(minutosAtras(10), AGORA)).toBe('EM_DIA');
    expect(situacaoDaVigilancia(minutosAtras(60), AGORA)).toBe('EM_DIA');
  });

  it('atrasada passada uma hora', () => {
    expect(situacaoDaVigilancia(minutosAtras(61), AGORA)).toBe('ATRASADA');
  });

  it('distingue "nunca executou" de "não deu para consultar"', () => {
    expect(situacaoDaVigilancia(null, AGORA)).toBe('NUNCA_EXECUTOU');
    expect(situacaoDaVigilancia(undefined, AGORA)).toBe('DESCONHECIDA');
  });
});

describe('avaliarSaudeCompleta', () => {
  it('200 só com o banco respondendo e a vigilância em dia', () => {
    expect(avaliarSaudeCompleta({ bancoResponde: true, ultimaVigilanciaEm: minutosAtras(25), agora: AGORA })).toEqual({
      status: 200,
      corpo: { situacao: 'OK', banco: 'OK', vigilancia: 'EM_DIA' },
    });
  });

  it('503 com o worker parado (vigilância atrasada ou nunca executada), mesmo com o banco no ar', () => {
    const atrasada = avaliarSaudeCompleta({ bancoResponde: true, ultimaVigilanciaEm: minutosAtras(90), agora: AGORA });
    expect(atrasada).toEqual({ status: 503, corpo: { situacao: 'FALHA', banco: 'OK', vigilancia: 'ATRASADA' } });
    const nunca = avaliarSaudeCompleta({ bancoResponde: true, ultimaVigilanciaEm: null, agora: AGORA });
    expect(nunca.status).toBe(503);
  });

  it('503 com o banco fora do ar, mesmo com a vigilância em dia', () => {
    const resposta = avaliarSaudeCompleta({ bancoResponde: false, ultimaVigilanciaEm: minutosAtras(5), agora: AGORA });
    expect(resposta).toEqual({ status: 503, corpo: { situacao: 'FALHA', banco: 'FALHA', vigilancia: 'EM_DIA' } });
  });

  it('503 quando não deu para consultar a vigilância', () => {
    expect(avaliarSaudeCompleta({ bancoResponde: true, ultimaVigilanciaEm: undefined, agora: AGORA }).status).toBe(503);
  });
});
