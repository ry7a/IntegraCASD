import type { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { CobrancaInvalida, type FiltrosDaConsulta } from '../dominio/cobranca.js';
import { CobrancasRepositorio } from './cobrancas.repositorio.js';

// Dublê do Prisma que anota o que foi gravado dentro da transação. `jaMudou`: outro usuário (ou a
// conciliação) mudou a situação da cobrança antes deste cancelamento.
function prismaFalso(jaMudou = false) {
  const gravado: string[] = [];
  const tx = {
    cobranca: {
      updateMany: async ({ where }: { where: { situacao: string } }) => {
        gravado.push(`cancela se ${where.situacao}`);
        return { count: jaMudou ? 0 : 1 };
      },
    },
    registroAuditoria: {
      create: async ({ data }: { data: { detalhe: string } }) => {
        gravado.push(`trilha: ${data.detalhe}`);
        return {};
      },
    },
  };
  const prisma = { $transaction: async (trabalho: (t: typeof tx) => Promise<unknown>) => trabalho(tx) };
  return { prisma: prisma as unknown as PrismaService, gravado };
}

describe('CobrancasRepositorio.cancelar [Cobranças.RF004]', () => {
  it('cancela só cobrança ainda aberta e registra na trilha', async () => {
    const { prisma, gravado } = prismaFalso();
    await new CobrancasRepositorio(prisma).cancelar('cob-1', 'Erro de valor', 'usuario-1');
    expect(gravado).toEqual(['cancela se ABERTA', 'trilha: Cobrança cancelada no Asaas e aqui. Motivo: Erro de valor']);
  });

  it('herdada: a trilha diz que ela não existe no Asaas (ADR-0005)', async () => {
    const { prisma, gravado } = prismaFalso();
    await new CobrancasRepositorio(prisma).cancelar('cob-1', 'Renegociação', 'usuario-1', true);
    expect(gravado[1]).toMatch(/herdada da planilha cancelada \(não existe no Asaas\)/);
  });

  it('paga por outro usuário nesse meio-tempo: recusa e não grava a trilha', async () => {
    const { prisma, gravado } = prismaFalso(true);
    await expect(new CobrancasRepositorio(prisma).cancelar('cob-1', 'Erro de valor', 'usuario-1')).rejects.toBeInstanceOf(
      CobrancaInvalida,
    );
    expect(gravado).toEqual(['cancela se ABERTA']);
  });
});

describe('CobrancasRepositorio.listar [Cobranças.RF008]', () => {
  // Dublê do Prisma que anota o filtro (where) da consulta. A conferência de ponta a ponta, com o
  // PostgreSQL de verdade, fica no CT-COB-08.
  function prismaQueAnotaOFiltro() {
    const filtros: unknown[] = [];
    const prisma = {
      cobranca: {
        findMany: async ({ where }: { where: unknown }) => {
          filtros.push(where);
          return [];
        },
        count: async () => 0,
      },
      $transaction: async (consultas: Promise<unknown>[]) => Promise.all(consultas),
    };
    return { prisma: prisma as unknown as PrismaService, filtros };
  }

  const SEM_FILTROS: FiltrosDaConsulta = {
    situacoes: ['ABERTA'],
    busca: null,
    alunoId: null,
    vencimentoDe: null,
    vencimentoAte: null,
    valorMinimoCentavos: null,
    valorMaximoCentavos: null,
    pagina: 1,
    tamanhoPagina: 50,
  };

  it('busca %, _ e \\ como texto: escapa os curingas do LIKE (defeito D9)', async () => {
    const { prisma, filtros } = prismaQueAnotaOFiltro();
    await new CobrancasRepositorio(prisma).listar({ ...SEM_FILTROS, busca: 'a%b_c\\d' }, '2026-11-13');
    expect(filtros[0]).toMatchObject({
      AND: expect.arrayContaining([{ aluno: { OR: [{ nome: { contains: 'a\\%b\\_c\\\\d', mode: 'insensitive' } }] } }]),
    });
  });
});
