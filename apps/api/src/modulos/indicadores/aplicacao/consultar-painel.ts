import { BadRequestException, Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { PeriodoInvalido, lerMes, somarMeses, variacao } from '../dominio/periodo.js';
import { IndicadoresRepositorio } from '../infra/indicadores.repositorio.js';

// [Indicadores.RF002] fluxo A2: vencida há mais de 7 dias sem sincronizar é sinalizada no painel.
const DIAS_SEM_SINCRONIZAR = 7;
// Passo de evolução: os 6 meses até o de referência.
export const MESES_DA_EVOLUCAO = 6;

export type ResumoDoPainel = {
  mes: string;
  entradasCentavos: number;
  saidasCentavos: number;
  resultadoCentavos: number;
  // Variação % sobre o mês anterior; nula se lá não houve movimento.
  variacaoEntradasPercentual: number | null;
  variacaoSaidasPercentual: number | null;
  // Fluxo A1: mês sem nenhuma movimentação (a tela avisa, em vez de mostrar só zeros).
  semMovimentacao: boolean;
  aguardandoLiberacaoCentavos: number;
  vencidasSemSincronizar: number;
};

export type PontoDaEvolucao = { mes: string; entradasCentavos: number; saidasCentavos: number; resultadoCentavos: number };

function lerPeriodo(mesPedido: unknown, hoje: string): string {
  try {
    return lerMes(mesPedido, hoje);
  } catch (erro) {
    if (erro instanceof PeriodoInvalido) throw new BadRequestException(erro.message);
    throw erro;
  }
}

// Caso de uso [Indicadores.RF001]: posição financeira do mês, comparada ao anterior. Não altera nada.
@Injectable()
export class ConsultarResumoDoPainel {
  constructor(private readonly indicadores: IndicadoresRepositorio) {}

  async executar(mesPedido: unknown, hoje = hojeEmSaoPaulo()): Promise<ResumoDoPainel> {
    const mes = lerPeriodo(mesPedido, hoje);
    const [atual, anterior, aguardando, semSincronizar] = await Promise.all([
      this.indicadores.totaisDoMes(mes),
      this.indicadores.totaisDoMes(somarMeses(mes, -1)),
      this.indicadores.aguardandoLiberacao(hoje),
      this.indicadores.vencidasSemSincronizar(hoje, DIAS_SEM_SINCRONIZAR),
    ]);
    return {
      mes,
      entradasCentavos: atual.entradasCentavos,
      saidasCentavos: atual.saidasCentavos,
      resultadoCentavos: atual.entradasCentavos - atual.saidasCentavos,
      variacaoEntradasPercentual: variacao(atual.entradasCentavos, anterior.entradasCentavos),
      variacaoSaidasPercentual: variacao(atual.saidasCentavos, anterior.saidasCentavos),
      semMovimentacao: atual.entradasCentavos === 0 && atual.saidasCentavos === 0,
      aguardandoLiberacaoCentavos: aguardando,
      vencidasSemSincronizar: semSincronizar,
    };
  }
}

// Caso de uso [Indicadores.RF001]: entradas e saídas dos 6 meses até o de referência, do mais antigo
// para o mais recente (o gráfico também tem a tabela, fluxo A3).
@Injectable()
export class ConsultarEvolucao {
  constructor(private readonly indicadores: IndicadoresRepositorio) {}

  async executar(mesPedido: unknown, hoje = hojeEmSaoPaulo()): Promise<PontoDaEvolucao[]> {
    const ate = lerPeriodo(mesPedido, hoje);
    const meses = Array.from({ length: MESES_DA_EVOLUCAO }, (_, indice) => somarMeses(ate, indice - (MESES_DA_EVOLUCAO - 1)));
    const totais = await Promise.all(meses.map((mes) => this.indicadores.totaisDoMes(mes)));
    return meses.map((mes, indice) => ({
      mes,
      entradasCentavos: totais[indice].entradasCentavos,
      saidasCentavos: totais[indice].saidasCentavos,
      resultadoCentavos: totais[indice].entradasCentavos - totais[indice].saidasCentavos,
    }));
  }
}
