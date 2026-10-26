import { Injectable, NotFoundException } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { TotaisPorVinculo } from '../../movimentacoes/index.js';
import { DadoInvalido } from '../dominio/comum.js';
import {
  lerDadosParaAlteracao,
  lerDadosParaInclusao,
  lerEncerramento,
  situacaoDoContrato,
  type EntradaDoContrato,
  type SituacaoExibida,
} from '../dominio/contrato.js';
import { ContratosRepositorio, type ContratoRegistrado } from '../infra/contratos.repositorio.js';
import { traduzirErrosDoCadastro } from './erros-do-cadastro.js';

// Casos de uso dos contratos [Cadastros.RF004]. Pequenos e ligados ao mesmo cadastro.

export type ContratoComSituacao = ContratoRegistrado & {
  situacao: SituacaoExibida;
  // Dias até o término; negativo se já passou; nulo se o prazo é indeterminado.
  diasParaVencer: number | null;
  // Saídas pagas neste contrato no ano corrente (dado de Movimentações).
  pagoNoAnoCentavos: number;
};

export type FiltroDeContratos = 'vigentes' | 'encerrados' | 'todos';

function comSituacao(contrato: ContratoRegistrado, hoje: string, pagoNoAno: Map<string, number>): ContratoComSituacao {
  return {
    ...contrato,
    ...situacaoDoContrato(contrato.encerrado, contrato.dataFim, hoje),
    pagoNoAnoCentavos: pagoNoAno.get(contrato.id) ?? 0,
  };
}

@Injectable()
export class ListarContratos {
  constructor(
    private readonly contratos: ContratosRepositorio,
    private readonly totais: TotaisPorVinculo,
  ) {}

  // Passo 2: a relação, com vigência, pago no ano e situação; e quantos vencem nos próximos 60 dias.
  async executar(filtro: FiltroDeContratos = 'vigentes', hoje = hojeEmSaoPaulo()): Promise<{ itens: ContratoComSituacao[]; quantidadeVencendo: number }> {
    const [todos, pagoNoAno] = await Promise.all([this.contratos.listar(), this.totais.pagoPorContrato(hoje.slice(0, 4))]);
    const comSituacoes = todos.map((contrato) => comSituacao(contrato, hoje, pagoNoAno));
    const itens = comSituacoes.filter((contrato) => {
      if (filtro === 'vigentes') return contrato.situacao !== 'ENCERRADO';
      if (filtro === 'encerrados') return contrato.situacao === 'ENCERRADO';
      return true;
    });
    return { itens, quantidadeVencendo: comSituacoes.filter((contrato) => contrato.situacao === 'VENCE_EM_BREVE').length };
  }
}

@Injectable()
export class CriarContrato {
  constructor(
    private readonly contratos: ContratosRepositorio,
    private readonly totais: TotaisPorVinculo,
  ) {}

  executar(entrada: EntradaDoContrato, autorId: string, hoje = hojeEmSaoPaulo()): Promise<ContratoComSituacao> {
    return traduzirErrosDoCadastro(async () => {
      const criado = await this.contratos.criar(lerDadosParaInclusao(entrada), hoje.slice(0, 4), autorId);
      return comSituacao(criado, hoje, await this.totais.pagoPorContrato(hoje.slice(0, 4)));
    });
  }
}

@Injectable()
export class AlterarContrato {
  constructor(
    private readonly contratos: ContratosRepositorio,
    private readonly totais: TotaisPorVinculo,
  ) {}

  executar(id: string, entrada: EntradaDoContrato, autorId: string, hoje = hojeEmSaoPaulo()): Promise<ContratoComSituacao> {
    return traduzirErrosDoCadastro(async () => {
      const atual = await this.contratos.buscarPorId(id);
      if (atual === null) throw new NotFoundException('Contrato não encontrado. Atualize a lista e tente de novo.');
      if (atual.encerrado) throw new DadoInvalido('Este contrato está encerrado e não pode mais ser alterado.');
      const alterado = await this.contratos.alterar(id, lerDadosParaAlteracao(entrada, atual), autorId);
      return comSituacao(alterado, hoje, await this.totais.pagoPorContrato(hoje.slice(0, 4)));
    });
  }
}

// Fluxo A1: encerramento antecipado.
@Injectable()
export class EncerrarContrato {
  constructor(
    private readonly contratos: ContratosRepositorio,
    private readonly totais: TotaisPorVinculo,
  ) {}

  executar(
    id: string,
    entrada: { dataEncerramento?: unknown; justificativa?: unknown },
    autorId: string,
    hoje = hojeEmSaoPaulo(),
  ): Promise<ContratoComSituacao> {
    return traduzirErrosDoCadastro(async () => {
      const atual = await this.contratos.buscarPorId(id);
      if (atual === null) throw new NotFoundException('Contrato não encontrado. Atualize a lista e tente de novo.');
      if (atual.encerrado) throw new DadoInvalido('Este contrato já está encerrado.');
      const { dataEncerramento, justificativa } = lerEncerramento(entrada, atual.dataInicio);
      const encerrado = await this.contratos.encerrar(id, dataEncerramento, justificativa, autorId);
      return comSituacao(encerrado, hoje, await this.totais.pagoPorContrato(hoje.slice(0, 4)));
    });
  }
}
