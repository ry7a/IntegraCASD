// Regras do indicador de gastos por categoria [Indicadores.RF003]. Só TypeScript puro.
import { percentual, variacao } from './periodo.js';

export type SaidasDaCategoria = { categoriaId: string; categoriaNome: string; valorCentavos: number };

export type GastoPorCategoria = {
  categoriaId: string;
  categoriaNome: string;
  valorCentavos: number;
  // Parte do total de saídas do mês, com uma casa decimal.
  percentual: number;
  // Fluxo A1: comparação com o mês anterior.
  valorMesAnteriorCentavos: number;
  variacaoPercentual: number | null;
};

export type GastosPorCategoria = {
  totalSaidasCentavos: number;
  totalMesAnteriorCentavos: number;
  // Do maior para o menor gasto do mês. Categorias só com gasto no mês anterior vêm no fim, com zero.
  itens: GastoPorCategoria[];
};

export function apurarGastos(doMes: SaidasDaCategoria[], doMesAnterior: SaidasDaCategoria[]): GastosPorCategoria {
  const total = doMes.reduce((soma, item) => soma + item.valorCentavos, 0);
  const totalAnterior = doMesAnterior.reduce((soma, item) => soma + item.valorCentavos, 0);
  const anteriores = new Map(doMesAnterior.map((item) => [item.categoriaId, item]));
  const categorias = new Map<string, SaidasDaCategoria>();
  for (const item of [...doMesAnterior.map((anterior) => ({ ...anterior, valorCentavos: 0 })), ...doMes]) {
    categorias.set(item.categoriaId, item);
  }
  const itens = [...categorias.values()].map((item) => {
    const anterior = anteriores.get(item.categoriaId)?.valorCentavos ?? 0;
    return {
      categoriaId: item.categoriaId,
      categoriaNome: item.categoriaNome,
      valorCentavos: item.valorCentavos,
      percentual: percentual(item.valorCentavos, total),
      valorMesAnteriorCentavos: anterior,
      variacaoPercentual: variacao(item.valorCentavos, anterior),
    };
  });
  itens.sort((a, b) => b.valorCentavos - a.valorCentavos || b.valorMesAnteriorCentavos - a.valorMesAnteriorCentavos);
  return { totalSaidasCentavos: total, totalMesAnteriorCentavos: totalAnterior, itens };
}
