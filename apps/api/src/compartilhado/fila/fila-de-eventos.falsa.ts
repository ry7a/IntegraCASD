import { FilaDeEventos } from './fila-de-eventos.js';

// Dublê de teste: não enfileira nada de verdade, só guarda os pedidos para o teste conferir.
export class FilaDeEventosFalsa extends FilaDeEventos {
  readonly enfileirados: string[] = [];

  // Ligue para simular a fila fora do ar.
  indisponivel = false;

  private processar: ((eventoId: string) => Promise<void>) | null = null;

  enfileirarProcessamento(eventoId: string): Promise<void> {
    if (this.indisponivel) {
      return Promise.reject(new Error('Fila indisponível.'));
    }
    this.enfileirados.push(eventoId);
    return Promise.resolve();
  }

  consumir(processar: (eventoId: string) => Promise<void>): Promise<void> {
    this.processar = processar;
    return Promise.resolve();
  }

  // Faz o papel da fila entregando um evento ao consumidor registrado.
  async entregar(eventoId: string): Promise<void> {
    if (this.processar === null) {
      throw new Error('Nenhum consumidor registrado.');
    }
    await this.processar(eventoId);
  }
}
