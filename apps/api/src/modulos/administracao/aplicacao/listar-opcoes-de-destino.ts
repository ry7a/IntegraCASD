import { Injectable } from '@nestjs/common';
import { ParametrosRepositorio, type OpcoesDeDestino } from '../infra/parametros.repositorio.js';

// Caso de uso [Administração.RF003]: contas e categorias que podem receber os pagamentos conciliados.
@Injectable()
export class ListarOpcoesDeDestino {
  constructor(private readonly parametros: ParametrosRepositorio) {}

  executar(): Promise<OpcoesDeDestino> {
    return this.parametros.buscarOpcoesDeDestino();
  }
}
