import { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { EventosWebhookRepositorio } from './eventos-webhook.repositorio.js';

const dados = { idAsaas: 'evt_falso_1', tipo: 'PAYMENT_RECEIVED', payload: { id: 'evt_falso_1' } };
const registro = { id: 'uuid-1', ...dados, processadoEm: null };

function erroDeDuplicidade() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'teste',
  });
}

// Dublê do Prisma: só os dois métodos que o repositório usa.
function criarPrismaFalso(create: () => Promise<unknown>) {
  return {
    eventoWebhook: { create, findUniqueOrThrow: async () => registro },
  } as unknown as PrismaService;
}

describe('EventosWebhookRepositorio', () => {
  it('grava um evento novo e avisa que é novo', async () => {
    const repositorio = new EventosWebhookRepositorio(criarPrismaFalso(async () => registro));

    const resultado = await repositorio.registrar(dados);

    expect(resultado.novo).toBe(true);
  });

  it('devolve o registro existente, sem erro, quando o evento é repetido', async () => {
    const repositorio = new EventosWebhookRepositorio(
      criarPrismaFalso(() => Promise.reject(erroDeDuplicidade())),
    );

    const resultado = await repositorio.registrar(dados);

    expect(resultado).toEqual({ evento: registro, novo: false });
  });

  it('não esconde outros erros do banco', async () => {
    const repositorio = new EventosWebhookRepositorio(
      criarPrismaFalso(() => Promise.reject(new Error('banco fora do ar'))),
    );

    await expect(repositorio.registrar(dados)).rejects.toThrow('banco fora do ar');
  });
});
