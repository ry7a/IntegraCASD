import { Injectable } from '@nestjs/common';
import { ParametrosRepositorio, type ParametrosVigentes } from '../infra/parametros.repositorio.js';

export type { ParametrosVigentes };

// Caso de uso exportado (Cobranças usa para o vencimento sugerido, a multa e os juros de cada
// cobrança). Nulo enquanto a diretoria não cadastrar os parâmetros [Administração.RF003].
@Injectable()
export class BuscarParametrosVigentes {
  constructor(private readonly parametros: ParametrosRepositorio) {}

  executar(): Promise<ParametrosVigentes | null> {
    return this.parametros.buscarVigentes();
  }
}
