import type { Prisma } from '../../generated/prisma/client.js';
import { registrarNaTrilha } from './trilha.js';

describe('registrarNaTrilha [Segurança.NF006]', () => {
  it('grava usuário, operação, entidade, registro afetado e detalhe na transação recebida', async () => {
    const gravados: unknown[] = [];
    const tx = {
      registroAuditoria: { create: async (argumentos: unknown) => void gravados.push(argumentos) },
    } as unknown as Prisma.TransactionClient;

    await registrarNaTrilha(tx, {
      usuarioId: 'usuario-1',
      operacao: 'INATIVACAO',
      entidade: 'CATEGORIA',
      registroId: 'cat-1',
      detalhe: 'Categoria "Zeladoria" inativada.',
    });

    expect(gravados).toEqual([
      {
        data: {
          usuarioId: 'usuario-1',
          operacao: 'INATIVACAO',
          entidade: 'CATEGORIA',
          registroId: 'cat-1',
          detalhe: 'Categoria "Zeladoria" inativada.',
        },
      },
    ]);
  });

  it('rotina automática é registrada com usuário nulo', async () => {
    const gravados: Array<{ data: { usuarioId: string | null } }> = [];
    const tx = {
      registroAuditoria: { create: async (argumentos: { data: { usuarioId: string | null } }) => void gravados.push(argumentos) },
    } as unknown as Prisma.TransactionClient;

    await registrarNaTrilha(tx, {
      usuarioId: null,
      operacao: 'INCLUSAO',
      entidade: 'COBRANCA',
      registroId: 'cob-1',
      detalhe: 'Mensalidade gerada pela rotina recorrente.',
    });

    expect(gravados[0]?.data.usuarioId).toBeNull();
  });
});
