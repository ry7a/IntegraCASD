// Contrato da fila de processamento dos eventos do Asaas.
// Quem recebe o evento (webhook) só pede para enfileirar; quem processa é o worker.
// Só a implementação deste contrato (fila-de-eventos.pgboss.ts) fala com o pg-boss;
// o resto do código depende deste contrato, e os testes usam o dublê.
//
// Classe abstrata pelo mesmo motivo do ClienteAsaas: o NestJS injeta pelo nome da classe.

export abstract class FilaDeEventos {
  // Pede o processamento do evento já gravado. Deve ser inofensivo se o mesmo evento for
  // enfileirado mais de uma vez: quem processa confere se o evento já foi processado.
  abstract enfileirarProcessamento(eventoId: string): Promise<void>;

  // Registra a função que processa cada evento da fila. Só o worker chama isto.
  // Se `processar` lançar erro, a fila tenta de novo mais tarde.
  abstract consumir(processar: (eventoId: string) => Promise<void>): Promise<void>;
}
