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

  // [Indicadores.RF001] Entradas e saídas do mês. Fora: o par estornada + espelho e as transferências
  // entre contas (as mesmas regras dos totais da consulta de movimentações).
  async totaisDoMes(mes: string): Promise<{ entradasCentavos: number; saidasCentavos: number }> {
    const { inicio, fim } = limitesDoMes(mes);
    const grupos = await this.prisma.movimentacao.groupBy({
      by: ['tipo'],
      where: {
        data: { gte: deDia(inicio), lte: deDia(fim) },
        origem: { not: 'ESTORNO' },
        estorno: { is: null },
        transferenciaParId: null,
        transferenciaParDe: { is: null },
      },
      _sum: { valorCentavos: true },
    });
    const total = (tipo: 'ENTRADA' | 'SAIDA') => grupos.find((grupo) => grupo.tipo === tipo)?._sum.valorCentavos ?? 0;
    return { entradasCentavos: total('ENTRADA'), saidasCentavos: total('SAIDA') };
  }

  // [Indicadores.RF001] fluxo A2: pago pelo aluno e ainda não disponível na conta do Asaas. É o valor da
  // entrada criada na baixa, enquanto a data de disponibilidade não chegou (ou não foi informada).
  async aguardandoLiberacao(hoje: string): Promise<number> {
    const total = await this.prisma.movimentacao.aggregate({
      where: {
        cobranca: {
          situacao: 'PAGA',
          OR: [{ disponivelEm: null }, { disponivelEm: { gt: deDia(hoje) } }],
        },
      },
      _sum: { valorCentavos: true },
    });
    return total._sum.valorCentavos ?? 0;
  }

  // [Indicadores.RF002] fluxo A2: vencidas cuja última sincronização (ou, sem ela, o vencimento) tem
  // mais de `dias` dias.
  async vencidasSemSincronizar(hoje: string, dias: number): Promise<number> {
    const limite = new Date(deDia(hoje).getTime() - dias * 86_400_000);
    return this.prisma.cobranca.count({
      where: {
        situacao: 'ABERTA',
        vencimento: { lt: deDia(hoje) },
        OR: [{ sincronizadaEm: null, vencimento: { lt: limite } }, { sincronizadaEm: { lt: limite } }],
      },
    });
  }

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
