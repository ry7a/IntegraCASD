import type { EventoWebhook } from '../../../generated/prisma/client.js';
import type { EventosWebhookRepositorio } from '../infra/eventos-webhook.repositorio.js';
import { ProcessarEventoWebhook } from './processar-evento-webhook.js';

// Dados fictícios (LGPD).
function criarEvento(processadoEm: Date | null): EventoWebhook {
  return {
    id: 'uuid-do-evento',
    idAsaas: 'evt_falso_1',
    tipo: 'PAYMENT_RECEIVED',
    payload: { id: 'evt_falso_1', event: 'PAYMENT_RECEIVED' },
    processadoEm,
    dataCriacao: new Date('2026-01-01'),
    dataAlteracao: new Date('2026-01-01'),
  };
}

// Dublê do repositório: devolve o que o teste combinar, sem tocar no banco.
function criarRepositorioFalso(evento: EventoWebhook | null) {
  return { buscarPorId: async () => evento } as unknown as EventosWebhookRepositorio;
}

describe('ProcessarEventoWebhook', () => {
  it('registra o recebimento de um evento ainda não processado', async () => {
    const casoDeUso = new ProcessarEventoWebhook(criarRepositorioFalso(criarEvento(null)));

    await expect(casoDeUso.executar('uuid-do-evento')).resolves.toBe('registrado');
  });

  it('não processa de novo um evento que já foi processado', async () => {
    const casoDeUso = new ProcessarEventoWebhook(
      criarRepositorioFalso(criarEvento(new Date('2026-01-02'))),
    );

    await expect(casoDeUso.executar('uuid-do-evento')).resolves.toBe('ja-processado');
  });

  it('lança erro se o evento não existe, para a fila tentar de novo', async () => {
    const casoDeUso = new ProcessarEventoWebhook(criarRepositorioFalso(null));

    await expect(casoDeUso.executar('uuid-inexistente')).rejects.toThrow('não encontrado');
  });
});
