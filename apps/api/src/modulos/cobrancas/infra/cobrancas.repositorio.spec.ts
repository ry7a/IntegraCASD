import type { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import { CobrancaInvalida } from '../dominio/cobranca.js';
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
