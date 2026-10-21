import { FilaDeEventosFalsa } from '../../../compartilhado/fila/fila-de-eventos.falsa.js';
import type { ProcessarEventoWebhook } from '../aplicacao/processar-evento-webhook.js';
import { ConsumidorDeEventosWebhook } from './consumidor-de-eventos-webhook.js';

// Dublê do caso de uso: guarda os ids que recebeu.
function criarCasoDeUsoFalso(erro?: Error) {
  const recebidos: string[] = [];
  const casoDeUso = {
    executar: async (eventoId: string) => {
      if (erro) throw erro;
      recebidos.push(eventoId);
    },
  } as unknown as ProcessarEventoWebhook;
  return { casoDeUso, recebidos };
}

describe('ConsumidorDeEventosWebhook', () => {
  it('entrega ao caso de uso cada evento que chega pela fila', async () => {
    const fila = new FilaDeEventosFalsa();
    const { casoDeUso, recebidos } = criarCasoDeUsoFalso();
    await new ConsumidorDeEventosWebhook(fila, casoDeUso).iniciar();

    await fila.entregar('uuid-1');
    await fila.entregar('uuid-2');

    expect(recebidos).toEqual(['uuid-1', 'uuid-2']);
  });

  it('deixa o erro do caso de uso subir, para a fila tentar de novo', async () => {
    const fila = new FilaDeEventosFalsa();
    const { casoDeUso } = criarCasoDeUsoFalso(new Error('falhou'));
    await new ConsumidorDeEventosWebhook(fila, casoDeUso).iniciar();

    await expect(fila.entregar('uuid-1')).rejects.toThrow('falhou');
  });
});
