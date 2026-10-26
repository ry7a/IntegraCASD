import { Injectable } from '@nestjs/common';
import { ExecucoesRepositorio, type ExecucaoRegistrada } from '../infra/execucoes.repositorio.js';

// Caso de uso [Confiabilidade.NF007], [Administração.RF003]: as últimas execuções da geração
// recorrente, da mais recente, com as falhas de cada uma (fluxo A2 do RF003).
@Injectable()
export class ListarExecucoesDaGeracao {
  constructor(private readonly execucoes: ExecucoesRepositorio) {}

  executar(quantidade = 5): Promise<ExecucaoRegistrada[]> {
    return this.execucoes.ultimas(quantidade);
  }
}
