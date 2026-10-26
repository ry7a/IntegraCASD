import { Injectable } from '@nestjs/common';
import { deDia, paraDia } from '../../../compartilhado/datas.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import type { CobrancaVencida } from '../dominio/inadimplencia.js';

// Consultas dos indicadores [Indicadores.RF001 a RF003]. Só leitura: os indicadores juntam dados de
// Cobranças e Movimentações, e consultar as tabelas direto evita trazer milhares de registros pelos
// casos de uso desses módulos só para somar. Nenhum dado é alterado aqui.
@Injectable()
export class IndicadoresRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  // [Indicadores.RF002] "Vencida" é aberta com vencimento antes de hoje (não é guardada).
  async cobrancasVencidas(hoje: string): Promise<CobrancaVencida[]> {
    const registros = await this.prisma.cobranca.findMany({
      where: { situacao: 'ABERTA', vencimento: { lt: deDia(hoje) } },
      select: { alunoId: true, valorCentavos: true, vencimento: true, aluno: { select: { nome: true } } },
    });
    return registros.map((registro) => ({
      alunoId: registro.alunoId,
      alunoNome: registro.aluno.nome,
      valorCentavos: registro.valorCentavos,
      vencimento: paraDia(registro.vencimento),
    }));
  }
}
