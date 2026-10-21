import { FilaDeEventosFalsa } from '../../../compartilhado/fila/fila-de-eventos.falsa.js';
import type { EventoWebhook } from '../../../generated/prisma/client.js';
import type { EventosWebhookRepositorio } from '../infra/eventos-webhook.repositorio.js';
import { ReceberEventoWebhook } from './receber-evento-webhook.js';

// Dados fictícios (LGPD).
const recebido = {
  idAsaas: 'evt_falso_1',
  tipo: 'PAYMENT_RECEIVED',
  payload: { id: 'evt_falso_1', event: 'PAYMENT_RECEIVED' },
};

function criarEvento(processadoEm: Date | null): EventoWebhook {
  return {
    id: 'uuid-do-evento',
    idAsaas: recebido.idAsaas,
    tipo: recebido.tipo,
    payload: recebido.payload,
    processadoEm,
    dataCriacao: new Date('2026-01-01'),
    dataAlteracao: new Date('2026-01-01'),
  };
}

// Dublê do repositório: devolve o resultado combinado, sem tocar no banco.
function criarRepositorioFalso(evento: EventoWebhook, novo: boolean) {
  return { registrar: async () => ({ evento, novo }) } as unknown as EventosWebhookRepositorio;
}

describe('ReceberEventoWebhook', () => {
  it('enfileira o evento novo', async () => {
    const fila = new FilaDeEventosFalsa();
    const casoDeUso = new ReceberEventoWebhook(
      criarRepositorioFalso(criarEvento(null), true),
      fila,
    );

    await casoDeUso.executar(recebido);

    expect(fila.enfileirados).toEqual(['uuid-do-evento']);
  });

  it('não enfileira de novo um evento repetido que já foi processado', async () => {
    const fila = new FilaDeEventosFalsa();
    const casoDeUso = new ReceberEventoWebhook(
      criarRepositorioFalso(criarEvento(new Date('2026-01-02')), false),
      fila,
    );

    await casoDeUso.executar(recebido);

    expect(fila.enfileirados).toEqual([]);
  });

  it('enfileira de novo um evento repetido que ainda não foi processado', async () => {
    const fila = new FilaDeEventosFalsa();
    const casoDeUso = new ReceberEventoWebhook(
      criarRepositorioFalso(criarEvento(null), false),
      fila,
    );

    await casoDeUso.executar(recebido);

    expect(fila.enfileirados).toEqual(['uuid-do-evento']);
  });

  it('deixa o erro subir se a fila falhar, para o Asaas tentar de novo', async () => {
    const fila = new FilaDeEventosFalsa();
    fila.indisponivel = true;
    const casoDeUso = new ReceberEventoWebhook(
      criarRepositorioFalso(criarEvento(null), true),
      fila,
    );

    await expect(casoDeUso.executar(recebido)).rejects.toThrow('Fila indisponível.');
  });
});
