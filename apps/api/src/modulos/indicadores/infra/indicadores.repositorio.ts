import { Injectable } from '@nestjs/common';
import { deDia, paraDia } from '../../../compartilhado/datas.js';
import { PrismaService } from '../../../compartilhado/prisma/prisma.service.js';
import type { SaidasDaCategoria } from '../dominio/gastos-por-categoria.js';
import type { CobrancaVencida } from '../dominio/inadimplencia.js';
import { limitesDoMes } from '../dominio/periodo.js';

// Consultas dos indicadores [Indicadores.RF001 a RF003]. Só leitura: os indicadores juntam dados de
// Cobranças e Movimentações, e consultar as tabelas direto evita trazer milhares de registros pelos
// casos de uso desses módulos só para somar. Nenhum dado é alterado aqui.
@Injectable()
export class IndicadoresRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  // [Indicadores.RF003] Saídas do mês por categoria. Fora: o par estornada + espelho (se anula) e as
  // transferências entre contas, que não são despesa (MER, regra 4).
  async saidasPorCategoria(mes: string): Promise<SaidasDaCategoria[]> {
    const { inicio, fim } = limitesDoMes(mes);
    const grupos = await this.prisma.movimentacao.groupBy({
      by: ['categoriaId'],
      where: {
        tipo: 'SAIDA',
        data: { gte: deDia(inicio), lte: deDia(fim) },
        origem: { not: 'ESTORNO' },
        estorno: { is: null },
        transferenciaParId: null,
        transferenciaParDe: { is: null },
      },
      _sum: { valorCentavos: true },
    });
    const categorias = await this.prisma.categoria.findMany({
      where: { id: { in: grupos.map((grupo) => grupo.categoriaId) } },
      select: { id: true, nome: true },
    });
    const nomes = new Map(categorias.map((categoria) => [categoria.id, categoria.nome]));
    return grupos.map((grupo) => ({
      categoriaId: grupo.categoriaId,
      categoriaNome: nomes.get(grupo.categoriaId) ?? '',
      valorCentavos: grupo._sum.valorCentavos ?? 0,
    }));
  }

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
