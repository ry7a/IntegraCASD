import { Injectable } from '@nestjs/common';
import { registrarNaTrilha } from '../../../compartilhado/auditoria/trilha.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import type { DestinoDaConciliacao, OpcaoDeDestino, ParametrosDeCobranca } from '../dominio/parametros-de-cobranca.js';

export type ParametrosVigentes = ParametrosDeCobranca & { alteradoEm: Date; alteradoPor: string };

// O que a tela oferece para o destino da conciliação: contas ativas e categorias ativas que aceitam entrada.
export type OpcoesDeDestino = {
  contas: Array<{ id: string; nome: string }>;
  categorias: Array<{ id: string; nome: string }>;
};

// Parâmetros de cobrança [Administração.RF003]: cada alteração é uma linha nova; a vigente é a mais recente.
@Injectable()
export class ParametrosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async buscarVigentes(): Promise<ParametrosVigentes | null> {
    const registro = await this.prisma.parametrosCobranca.findFirst({
      orderBy: { dataCriacao: 'desc' },
      include: { alteradoPor: { select: { nome: true } } },
    });
    if (registro === null) return null;
    return {
      valorMensalidadeCentavos: registro.valorMensalidadeCentavos,
      diaVencimento: registro.diaVencimento,
      diaGeracao: registro.diaGeracao,
      multaPercentual: registro.multaPercentual,
      jurosMensalPercentual: registro.jurosMensalPercentual,
      contaRecebimentoId: registro.contaRecebimentoId,
      categoriaMensalidadeId: registro.categoriaMensalidadeId,
      categoriaAvulsaId: registro.categoriaAvulsaId,
      alteradoEm: registro.dataCriacao,
      alteradoPor: registro.alteradoPor.nome,
    };
  }

  async buscarOpcoesDeDestino(): Promise<OpcoesDeDestino> {
    const [contas, categorias] = await Promise.all([
      this.prisma.conta.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
      this.prisma.categoria.findMany({
        where: { ativo: true, tipo: { in: ['ENTRADA', 'AMBOS'] } },
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
      }),
    ]);
    return { contas, categorias };
  }

  // Busca a conta e as categorias escolhidas, para o caso de uso conferir se servem.
  async encontrarDestino(destino: DestinoDaConciliacao): Promise<{
    conta: OpcaoDeDestino | null;
    categoriaMensalidade: OpcaoDeDestino | null;
    categoriaAvulsa: OpcaoDeDestino | null;
  }> {
    const categoria = (id: string | null) =>
      id === null ? null : this.prisma.categoria.findUnique({ where: { id }, select: { id: true, ativo: true, tipo: true } });
    const [conta, categoriaMensalidade, categoriaAvulsa] = await Promise.all([
      destino.contaRecebimentoId === null
        ? null
        : this.prisma.conta.findUnique({ where: { id: destino.contaRecebimentoId }, select: { id: true, ativo: true } }),
      categoria(destino.categoriaMensalidadeId),
      categoria(destino.categoriaAvulsaId),
    ]);
    return { conta, categoriaMensalidade, categoriaAvulsa };
  }

  async gravar(parametros: ParametrosDeCobranca, autorId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const criado = await tx.parametrosCobranca.create({ data: { ...parametros, alteradoPorId: autorId } });
      await registrarNaTrilha(tx, {
        usuarioId: autorId,
        operacao: 'ALTERACAO',
        entidade: 'CONFIGURACAO',
        registroId: criado.id,
        detalhe:
          `Parâmetros de cobrança: mensalidade ${parametros.valorMensalidadeCentavos} centavos, ` +
          `geração dia ${parametros.diaGeracao}, vencimento dia ${parametros.diaVencimento}, ` +
          `multa ${parametros.multaPercentual}%, juros ${parametros.jurosMensalPercentual}% ao mês` +
          (destinoCompleto(parametros)
            ? ', com conta e categorias de recebimento definidas.'
            : ', sem conta ou categorias de recebimento (a conciliação espera).'),
      });
    });
  }
}

function destinoCompleto(destino: DestinoDaConciliacao): boolean {
  return destino.contaRecebimentoId !== null && destino.categoriaMensalidadeId !== null && destino.categoriaAvulsaId !== null;
}
