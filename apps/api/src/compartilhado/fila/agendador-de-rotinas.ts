// Contrato das rotinas automáticas (geração recorrente, sincronização...). Classe abstrata pelo
// mesmo motivo da FilaDeEventos: o NestJS injeta pelo nome da classe. A implementação real usa o
// pg-boss; nos testes entra o dublê (agendador-de-rotinas.falso.ts).

export type DadosDaRotina = Record<string, unknown>;

// Nomes das rotinas (cada uma vira uma fila no pg-boss).
export const ROTINA_GERACAO_RECORRENTE = 'geracao-recorrente';
export const ROTINA_ATUALIZAR_CLIENTE_ASAAS = 'atualizar-cliente-asaas';
export const ROTINA_REPROCESSAR_EVENTOS = 'reprocessar-eventos-asaas';
export const ROTINA_SINCRONIZACAO = 'sincronizacao-asaas';
export const ROTINA_VIGILANCIA_DO_ASAAS = 'vigilancia-do-asaas';
export const ROTINAS = [
  ROTINA_GERACAO_RECORRENTE,
  ROTINA_ATUALIZAR_CLIENTE_ASAAS,
  ROTINA_REPROCESSAR_EVENTOS,
  ROTINA_SINCRONIZACAO,
  ROTINA_VIGILANCIA_DO_ASAAS,
];

export abstract class AgendadorDeRotinas {
  // Roda a rotina conforme a expressão cron, no fuso de São Paulo. Pode ser chamado a cada subida do
  // worker: o agendamento é atualizado, não duplicado.
  abstract agendar(rotina: string, cron: string): Promise<void>;

  // Pede uma execução agora (ex.: botão "gerar pendentes").
  abstract executarAgora(rotina: string, dados?: DadosDaRotina): Promise<void>;

  // Pede uma execução daqui a `segundos` (ex.: nova tentativa depois de o Asaas cair).
  abstract executarDepois(rotina: string, segundos: number, dados?: DadosDaRotina): Promise<void>;

  // Liga a rotina ao código que a executa. Só o worker chama.
  abstract consumir(rotina: string, executar: (dados: DadosDaRotina) => Promise<void>): Promise<void>;

  // Quando a rotina terminou sem erro pela última vez (null se não há registro). Usada pela saúde
  // completa (/api/saude/completa) para saber se o worker está vivo.
  abstract ultimaExecucaoConcluida(rotina: string): Promise<Date | null>;
}
