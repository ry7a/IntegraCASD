import { BadRequestException } from '@nestjs/common';
import { FilaDeEventosFalsa } from '../../../compartilhado/fila/fila-de-eventos.falsa.js';
import { ReceberEventoWebhook } from '../aplicacao/receber-evento-webhook.js';
import type { EventoRecebido } from '../aplicacao/receber-evento-webhook.js';
import { WebhookAsaasController } from './webhook-asaas.controller.js';

// O webhook nunca pode responder 500 ([Confiabilidade.NF001]): o evento fora dos limites do formato é
// recusado com 400 antes de gravar. O controller é montado com o caso de uso de verdade e dublês do
// repositório e da fila, para o teste conferir o que foi (ou não) gravado e enfileirado.
// Dados fictícios (LGPD).

// O tipo do repositório sai do construtor do caso de uso: api/ não importa infra/ nem o Prisma (B2, B3),
// nem nos testes.
type RepositorioDeEventos = ConstructorParameters<typeof ReceberEventoWebhook>[0];

// Dublê do repositório: anota o que seria gravado, sem banco. Devolve só os campos do evento gravado
// que o caso de uso lê (o id e se já foi processado).
class RepositorioFalso {
  readonly gravados: EventoRecebido[] = [];

  registrar(recebido: EventoRecebido) {
    this.gravados.push(recebido);
    return Promise.resolve({ evento: { id: `uuid-${this.gravados.length}`, processadoEm: null }, novo: true });
  }
}

function montarWebhook() {
  const repositorio = new RepositorioFalso();
  const fila = new FilaDeEventosFalsa();
  const casoDeUso = new ReceberEventoWebhook(repositorio as unknown as RepositorioDeEventos, fila);
  return { controller: new WebhookAsaasController(casoDeUso), repositorio, fila };
}

describe('[Confiabilidade.NF001] Webhook do Asaas: limites do formato do evento', () => {
  it('aceita no limite exato (id de 255, event de 100, corpo de 32 níveis) e grava o evento como veio', async () => {
    const { controller, repositorio, fila } = montarWebhook();
    // Espaços nas pontas e quebra de linha: o id é a chave da idempotência e não pode ser aparado.
    const id = ` evt\n${'e'.repeat(249)} `;
    const corpo = { id, event: 'P'.repeat(100), payment: listasAninhadas(31) };

    await expect(controller.receber(corpo)).resolves.toEqual({ recebido: true });

    expect(repositorio.gravados).toEqual([{ idAsaas: id, tipo: 'P'.repeat(100), payload: corpo }]);
    expect(fila.enfileirados).toEqual(['uuid-1']);
  });

  it('recusa com 400, sem gravar nem enfileirar, um id com mais de 255 caracteres', async () => {
    const { controller, repositorio, fila } = montarWebhook();

    const recebendo = controller.receber({ id: 'e'.repeat(256), event: 'PAYMENT_CREATED' });

    await expect(recebendo).rejects.toThrow(BadRequestException);
    await expect(recebendo).rejects.toThrow('"id"');
    expect(repositorio.gravados).toEqual([]);
    expect(fila.enfileirados).toEqual([]);
  });

  it('recusa com 400, sem gravar nem enfileirar, um event com mais de 100 caracteres', async () => {
    const { controller, repositorio, fila } = montarWebhook();

    const recebendo = controller.receber({ id: 'evt_falso_2', event: 'P'.repeat(101) });

    await expect(recebendo).rejects.toThrow(BadRequestException);
    await expect(recebendo).rejects.toThrow('"event"');
    expect(repositorio.gravados).toEqual([]);
    expect(fila.enfileirados).toEqual([]);
  });

  it('recusa com 400, sem gravar nem enfileirar, um id com caractere nulo', async () => {
    const { controller, repositorio, fila } = montarWebhook();

    const recebendo = controller.receber({ id: 'evt_falso_3\u0000fim', event: 'PAYMENT_CREATED' });

    await expect(recebendo).rejects.toThrow(BadRequestException);
    await expect(recebendo).rejects.toThrow('caractere nulo');
    expect(repositorio.gravados).toEqual([]);
    expect(fila.enfileirados).toEqual([]);
  });

  it.each([
    ['no event', { id: 'evt_falso_4', event: 'PAYMENT\u0000CREATED' }],
    ['num campo do pagamento', { id: 'evt_falso_4', event: 'PAYMENT_CREATED', payment: { id: 'pay_falso_4', description: 'texto\u0000com nulo' } }],
    ['num texto dentro de uma lista', { id: 'evt_falso_4', event: 'PAYMENT_CREATED', payment: { split: [{ descricao: ['a', 'b\u0000'] }] } }],
    ['no nome de uma chave', { id: 'evt_falso_4', event: 'PAYMENT_CREATED', payment: { 'chave\u0000': 1 } }],
  ])('recusa com 400, sem gravar nem enfileirar, um caractere nulo %s', async (_onde, corpo) => {
    const { controller, repositorio, fila } = montarWebhook();

    const recebendo = controller.receber(corpo);

    await expect(recebendo).rejects.toThrow(BadRequestException);
    await expect(recebendo).rejects.toThrow('caractere nulo');
    expect(repositorio.gravados).toEqual([]);
    expect(fila.enfileirados).toEqual([]);
  });

  // O corpo é o nível 1; o payment com 32 listas aninhadas leva o corpo a 33 níveis.
  it.each([32, 5000, 20000])(
    'recusa com 400, sem gravar nem enfileirar, um payment com %i listas aninhadas (corpo com mais de 32 níveis)',
    async (listas) => {
      const { controller, repositorio, fila } = montarWebhook();

      const recebendo = controller.receber({ id: 'evt_falso_5', event: 'PAYMENT_CREATED', payment: listasAninhadas(listas) });

      await expect(recebendo).rejects.toThrow(BadRequestException);
      await expect(recebendo).rejects.toThrow('32 níveis');
      expect(repositorio.gravados).toEqual([]);
      expect(fila.enfileirados).toEqual([]);
    },
  );
});

// [[[...]]] com `quantas` listas, montado num laço (e não por recursão) para o próprio teste não estourar a pilha.
function listasAninhadas(quantas: number): unknown {
  let valor: unknown = [];
  for (let lista = 1; lista < quantas; lista++) valor = [valor];
  return valor;
}
