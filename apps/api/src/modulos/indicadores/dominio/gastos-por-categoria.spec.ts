import { apurarGastos } from './gastos-por-categoria.js';
import { lerMes, percentual, somarMeses, variacao } from './periodo.js';

const categoria = (id: string, valorCentavos: number) => ({ categoriaId: id, categoriaNome: `Categoria ${id}`, valorCentavos });

describe('gastos por categoria [Indicadores.RF003]', () => {
  it('ordena por valor, com a participação de cada uma (uma casa decimal)', () => {
    const resultado = apurarGastos([categoria('a', 10000), categoria('b', 20000), categoria('c', 30000)], []);
    expect(resultado.totalSaidasCentavos).toBe(60000);
    expect(resultado.itens.map((item) => [item.categoriaId, item.percentual])).toEqual([
      ['c', 50],
      ['b', 33.3],
      ['a', 16.7],
    ]);
  });

  it('compara com o mês anterior (fluxo A1); categoria só do mês anterior aparece com zero', () => {
    const resultado = apurarGastos([categoria('a', 15000)], [categoria('a', 10000), categoria('b', 5000)]);
    expect(resultado.totalMesAnteriorCentavos).toBe(15000);
    expect(resultado.itens).toEqual([
      { categoriaId: 'a', categoriaNome: 'Categoria a', valorCentavos: 15000, percentual: 100, valorMesAnteriorCentavos: 10000, variacaoPercentual: 50 },
      { categoriaId: 'b', categoriaNome: 'Categoria b', valorCentavos: 0, percentual: 0, valorMesAnteriorCentavos: 5000, variacaoPercentual: -100 },
    ]);
  });

  it('mês sem saídas: total zero e lista vazia', () => {
    expect(apurarGastos([], [])).toEqual({ totalSaidasCentavos: 0, totalMesAnteriorCentavos: 0, itens: [] });
  });
});

describe('período dos indicadores [Indicadores.RF001]', () => {
  it('mês corrente por padrão; recusa formato inválido', () => {
    expect(lerMes(undefined, '2026-10-26')).toBe('2026-10');
    expect(lerMes('2026-09', '2026-10-26')).toBe('2026-09');
    expect(() => lerMes('2026-13', '2026-10-26')).toThrow(/AAAA-MM/);
  });

  it('vira o ano ao somar meses', () => {
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
    expect(somarMeses('2026-11', 3)).toBe('2027-02');
  });

  it('percentual e variação com uma casa; sem base, variação nula', () => {
    expect(percentual(1, 3)).toBe(33.3);
    expect(percentual(5, 0)).toBe(0);
    expect(variacao(110, 100)).toBe(10);
    expect(variacao(90, 100)).toBe(-10);
    expect(variacao(50, 0)).toBeNull();
  });
});
