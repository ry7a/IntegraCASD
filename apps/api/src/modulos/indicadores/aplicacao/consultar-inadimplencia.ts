import { Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { apurarInadimplencia, type Inadimplencia } from '../dominio/inadimplencia.js';
import { IndicadoresRepositorio } from '../infra/indicadores.repositorio.js';

// Caso de uso [Indicadores.RF002]: alunos com cobranças vencidas e não pagas. Não altera nada.
@Injectable()
export class ConsultarInadimplencia {
  constructor(private readonly indicadores: IndicadoresRepositorio) {}

  async executar(hoje = hojeEmSaoPaulo()): Promise<Inadimplencia> {
    return apurarInadimplencia(await this.indicadores.cobrancasVencidas(hoje), hoje);
  }
}
