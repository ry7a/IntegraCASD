import { BadRequestException } from '@nestjs/common';
import type { IndicadoresRepositorio } from '../infra/indicadores.repositorio.js';
import { ConsultarEvolucao, ConsultarResumoDoPainel } from './consultar-painel.js';

const HOJE = '2026-10-26';

// Dublê: totais por mês combinados no teste; os meses sem entrada valem zero.
function repositorio(porMes: Record<string, { entradasCentavos: number; saidasCentavos: number }>) {
  const meses: string[] = [];
  const falso = {
    totaisDoMes: async (mes: string) => {
      meses.push(mes);
      return porMes[mes] ?? { entradasCentavos: 0, saidasCentavos: 0 };
    },
    aguardandoLiberacao: async () => 17000,
    vencidasSemSincronizar: async () => 3,
  } as unknown as IndicadoresRepositorio;
  return { falso, meses };
}

describe('painel de indicadores [Indicadores.RF001]', () => {
  it('resultado do mês e variação sobre o anterior; aguardando liberação separado (fluxo A2)', async () => {
    const { falso } = repositorio({
      '2026-10': { entradasCentavos: 110000, saidasCentavos: 45000 },
      '2026-09': { entradasCentavos: 100000, saidasCentavos: 50000 },
    });
    expect(await new ConsultarResumoDoPainel(falso).executar(undefined, HOJE)).toEqual({
      mes: '2026-10',
      entradasCentavos: 110000,
      saidasCentavos: 45000,
      resultadoCentavos: 65000,
      variacaoEntradasPercentual: 10,
      variacaoSaidasPercentual: -10,
      semMovimentacao: false,
      aguardandoLiberacaoCentavos: 17000,
      vencidasSemSincronizar: 3,
    });
  });

  it('mês sem movimentação: zeros e aviso, sem erro (fluxo A1); sem base, variação nula', async () => {
    const resumo = await new ConsultarResumoDoPainel(repositorio({}).falso).executar('2026-08', HOJE);
    expect(resumo).toMatchObject({ mes: '2026-08', resultadoCentavos: 0, semMovimentacao: true, variacaoEntradasPercentual: null });
  });

  it('mês em formato inválido: 400', async () => {
    await expect(new ConsultarResumoDoPainel(repositorio({}).falso).executar('outubro', HOJE)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('evolução: os 6 meses até o de referência, do mais antigo ao mais recente, virando o ano', async () => {
    const { falso, meses } = repositorio({ '2026-02': { entradasCentavos: 500, saidasCentavos: 200 } });
    const evolucao = await new ConsultarEvolucao(falso).executar('2026-02', HOJE);
    expect(meses).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
    expect(evolucao.at(-1)).toEqual({ mes: '2026-02', entradasCentavos: 500, saidasCentavos: 200, resultadoCentavos: 300 });
  });
});
