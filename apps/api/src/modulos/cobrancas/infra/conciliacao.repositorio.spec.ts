import type { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { ConciliacaoConcorrente, ConciliacaoRepositorio, type CobrancaParaConciliar } from './conciliacao.repositorio.js';

// Dublê do Prisma que anota cada operação feita dentro da transação, na ordem.
// `eventoJaMarcado`: outro processamento marcou o evento antes. `cobrancaMudou`: a atualização
// condicional da cobrança não encontra mais a situação esperada.
function prismaFalso(opcoes: { eventoJaMarcado?: boolean; cobrancaMudou?: boolean } = {}) {
  const operacoes: string[] = [];
  const tx = {
    eventoWebhook: {
      updateMany: async () => {
        operacoes.push('marca evento');
        return { count: opcoes.eventoJaMarcado ? 0 : 1 };
      },
    },
    movimentacao: {
      create: async ({ data }: { data: { tipo: string; origem: string } }) => {
        operacoes.push(`cria movimentação ${data.tipo} ${data.origem}`);
        return { id: `mov-${operacoes.length}` };
      },
      findUniqueOrThrow: async () => ({ id: 'mov-original', contaId: 'c', categoriaId: 'k', valorCentavos: 8500 }),
    },
    cobranca: {
      updateMany: async ({ data }: { data: { situacao?: string } }) => {
        operacoes.push(`cobrança -> ${data.situacao ?? 'disponível'}`);
        return { count: opcoes.cobrancaMudou ? 0 : 1 };
      },
    },
    pendenciaConciliacao: {
      createMany: async ({ data }: { data: Array<{ tipo: string; idAsaas: string; origem: string }> }) => {
        operacoes.push(`pendência ${data[0].tipo} de ${data[0].idAsaas} (${data[0].origem})`);
        return { count: 1 };
      },
    },
    registroAuditoria: {
      create: async ({ data }: { data: { entidade: string; usuarioId: string | null } }) => {
        operacoes.push(`trilha ${data.entidade} por ${data.usuarioId ?? 'rotina'}`);
      },
    },
  };
  const prisma = { $transaction: async (trabalho: (t: typeof tx) => Promise<unknown>) => trabalho(tx) } as unknown as PrismaService;
  return { prisma, operacoes };
}

const evento = { id: 'uuid-do-evento', idAsaas: 'evt_falso_1' };
const cobranca: CobrancaParaConciliar = {
  id: 'uuid-da-cobranca',
  idAsaas: 'pay_falso_1',
  origem: 'AVULSA',
  descricao: 'Camiseta',
  situacao: 'ABERTA',
  valorCentavos: 8500,
  disponivelEm: null,
  movimentacaoId: 'mov-original',
};
const baixa = { tipo: 'BAIXAR', valorPagoCentavos: 8500, pagoEm: '2026-10-20', disponivelEm: null } as const;
const destino = { contaId: 'uuid-da-conta', categoriaId: 'uuid-da-categoria' };

describe('ConciliacaoRepositorio [Confiabilidade.NF004]', () => {
  it('marca o evento, cria a entrada, baixa a cobrança e grava a trilha na mesma transação', async () => {
    const { prisma, operacoes } = prismaFalso();
    await expect(new ConciliacaoRepositorio(prisma).aplicar(evento, cobranca, baixa, destino)).resolves.toBe('aplicado');
    expect(operacoes).toEqual([
      'marca evento',
      'cria movimentação ENTRADA CONCILIACAO_AUTOMATICA',
      'cobrança -> PAGA',
      'trilha COBRANCA por rotina',
      'trilha MOVIMENTACAO por rotina',
    ]);
  });

  it('evento já marcado por outro processamento: nada mais é feito [Confiabilidade.NF003]', async () => {
    const { prisma, operacoes } = prismaFalso({ eventoJaMarcado: true });
    await expect(new ConciliacaoRepositorio(prisma).aplicar(evento, cobranca, baixa, destino)).resolves.toBe('ja-processado');
    expect(operacoes).toEqual(['marca evento']);
  });

  it('cobrança mudou no meio: lança erro para desfazer a transação e a fila tentar de novo', async () => {
    const { prisma } = prismaFalso({ cobrancaMudou: true });
    await expect(new ConciliacaoRepositorio(prisma).aplicar(evento, cobranca, baixa, destino)).rejects.toBeInstanceOf(
      ConciliacaoConcorrente,
    );
  });

  it('estorno anula a entrada com uma movimentação espelho, sem apagar nada', async () => {
    const { prisma, operacoes } = prismaFalso();
    await new ConciliacaoRepositorio(prisma).aplicar(evento, { ...cobranca, situacao: 'PAGA' }, { tipo: 'ESTORNAR' }, null);
    expect(operacoes).toEqual([
      'marca evento',
      'cobrança -> ESTORNADA',
      'cria movimentação SAIDA ESTORNO',
      'trilha COBRANCA por rotina',
      'trilha MOVIMENTACAO por rotina',
    ]);
  });

  it('pendência marca o evento e entra na fila, sem tocar na cobrança [Cobranças.RF005]', async () => {
    const { prisma, operacoes } = prismaFalso();
    await new ConciliacaoRepositorio(prisma).aplicar(
      evento,
      null,
      { tipo: 'PENDENCIA', tipoDaPendencia: 'SEM_COBRANCA', motivo: 'conferir', idCobrancaAsaas: 'pay_x' },
      null,
    );
    expect(operacoes).toEqual(['marca evento', 'pendência SEM_COBRANCA de pay_x (WEBHOOK)']);
  });
});
