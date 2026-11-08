// Regras das rotas de saúde (/api/saude e /api/saude/completa). Funções puras: recebem o que foi medido
// e decidem a resposta, para o teste conferir sem banco nem fila.

// A vigilância do Asaas roda a cada 30 minutos no worker. Uma hora sem execução concluída quer dizer que
// pelo menos duas seguidas não aconteceram: o worker está parado (ou falhando sempre).
export const PRAZO_DA_VIGILANCIA_MS = 60 * 60 * 1000;

export type SituacaoDaVigilancia = 'EM_DIA' | 'ATRASADA' | 'NUNCA_EXECUTOU' | 'DESCONHECIDA';

// Corpo da resposta: só situações, sem mensagens de erro, endereços ou horários (rota pública).
export type RespostaDaSaude = {
  status: 200 | 503;
  corpo: {
    situacao: 'OK' | 'FALHA';
    banco: 'OK' | 'FALHA';
    vigilancia?: SituacaoDaVigilancia;
  };
};

// /api/saude: só o banco. A Railway usa esta rota para liberar cada implantação, por isso ela não
// depende do worker (na primeira subida da produção o worker ainda está desligado).
export function avaliarSaudeBasica(bancoResponde: boolean): RespostaDaSaude {
  return {
    status: bancoResponde ? 200 : 503,
    corpo: { situacao: bancoResponde ? 'OK' : 'FALHA', banco: bancoResponde ? 'OK' : 'FALHA' },
  };
}

// `ultimaVigilanciaEm`: quando a vigilância terminou pela última vez; null se nunca terminou;
// undefined se não foi possível consultar (fila fora do ar).
export function situacaoDaVigilancia(ultimaVigilanciaEm: Date | null | undefined, agora: Date): SituacaoDaVigilancia {
  if (ultimaVigilanciaEm === undefined) return 'DESCONHECIDA';
  if (ultimaVigilanciaEm === null) return 'NUNCA_EXECUTOU';
  return agora.getTime() - ultimaVigilanciaEm.getTime() <= PRAZO_DA_VIGILANCIA_MS ? 'EM_DIA' : 'ATRASADA';
}

// /api/saude/completa: o banco responde E a vigilância rodou na última hora. É a que o monitor externo
// (UptimeRobot) vigia, porque revela um worker parado.
export function avaliarSaudeCompleta(entrada: {
  bancoResponde: boolean;
  ultimaVigilanciaEm: Date | null | undefined;
  agora: Date;
}): RespostaDaSaude {
  const vigilancia = situacaoDaVigilancia(entrada.ultimaVigilanciaEm, entrada.agora);
  const saudavel = entrada.bancoResponde && vigilancia === 'EM_DIA';
  return {
    status: saudavel ? 200 : 503,
    corpo: {
      situacao: saudavel ? 'OK' : 'FALHA',
      banco: entrada.bancoResponde ? 'OK' : 'FALHA',
      vigilancia,
    },
  };
}
