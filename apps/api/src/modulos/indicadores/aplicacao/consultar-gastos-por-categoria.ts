import { BadRequestException, Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { apurarGastos, type GastosPorCategoria } from '../dominio/gastos-por-categoria.js';
import { PeriodoInvalido, lerMes, somarMeses } from '../dominio/periodo.js';
import { IndicadoresRepositorio } from '../infra/indicadores.repositorio.js';

// Caso de uso [Indicadores.RF003]: saídas do mês por categoria, com o comparativo do mês anterior
// (fluxo A1). Não altera nada.
@Injectable()
export class ConsultarGastosPorCategoria {
  constructor(private readonly indicadores: IndicadoresRepositorio) {}

  async executar(mesPedido: unknown, hoje = hojeEmSaoPaulo()): Promise<GastosPorCategoria & { mes: string }> {
    let mes: string;
    try {
      mes = lerMes(mesPedido, hoje);
    } catch (erro) {
      if (erro instanceof PeriodoInvalido) throw new BadRequestException(erro.message);
      throw erro;
    }
    const [doMes, doMesAnterior] = await Promise.all([
      this.indicadores.saidasPorCategoria(mes),
      this.indicadores.saidasPorCategoria(somarMeses(mes, -1)),
    ]);
    return { mes, ...apurarGastos(doMes, doMesAnterior) };
  }
}
