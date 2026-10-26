import { BadRequestException, Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { MovimentacaoInvalida, lerFiltros, regraDoEstorno } from '../dominio/movimentacao.js';
import { MovimentacoesRepositorio, type MovimentacaoRegistrada, type Totais } from '../infra/movimentacoes.repositorio.js';

export type ItemDaLista = MovimentacaoRegistrada & { podeEstornar: boolean; motivoSemEstorno: string | null };

// Caso de uso [Movimentações.RF003]: lista do recorte e totais. Não altera nada.
@Injectable()
export class ConsultarMovimentacoes {
  constructor(private readonly movimentacoes: MovimentacoesRepositorio) {}

  async executar(consulta: Record<string, unknown>, hoje = hojeEmSaoPaulo()): Promise<{ itens: ItemDaLista[]; totais: Totais }> {
    let filtros;
    try {
      filtros = lerFiltros(consulta, hoje);
    } catch (erro) {
      if (erro instanceof MovimentacaoInvalida) throw new BadRequestException(erro.message);
      throw erro;
    }
    const { itens, totais } = await this.movimentacoes.listar(filtros);
    return {
      itens: itens.map((item) => ({ ...item, ...regraDoEstorno(item.origem, item.estornadaEm !== null) })),
      totais,
    };
  }
}
