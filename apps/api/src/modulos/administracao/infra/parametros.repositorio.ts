import { Injectable } from '@nestjs/common';
import { registrarNaTrilha } from '../../../compartilhado/auditoria/trilha.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import type { ParametrosDeCobranca } from '../dominio/parametros-de-cobranca.js';

export type ParametrosVigentes = ParametrosDeCobranca & { alteradoEm: Date; alteradoPor: string };

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
      alteradoEm: registro.dataCriacao,
      alteradoPor: registro.alteradoPor.nome,
    };
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
          `multa ${parametros.multaPercentual}%, juros ${parametros.jurosMensalPercentual}% ao mês.`,
      });
    });
  }
}
