import { Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { MovimentacoesRepositorio, type OpcoesDaMovimentacao } from '../infra/movimentacoes.repositorio.js';

export type { OpcoesDaMovimentacao };

// Caso de uso [Movimentações.RF001 e RF003]: as listas do filtro e do diálogo "Nova movimentação".
@Injectable()
export class ListarOpcoesDaMovimentacao {
  constructor(private readonly movimentacoes: MovimentacoesRepositorio) {}

  executar(hoje = hojeEmSaoPaulo()): Promise<OpcoesDaMovimentacao> {
    return this.movimentacoes.opcoes(hoje.slice(0, 4));
  }
}
