import { Injectable, NotFoundException } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { TotaisPorVinculo } from '../../movimentacoes/index.js';
import { estaEncerrado, lerDadosParaAlteracao, lerDadosParaInclusao, type EntradaDoProjeto } from '../dominio/projeto.js';
import { ProjetosRepositorio, type ProjetoRegistrado } from '../infra/projetos.repositorio.js';
import { traduzirErrosDoCadastro } from './erros-do-cadastro.js';

// Casos de uso dos projetos [Cadastros.RF005].

export type ProjetoComTotais = ProjetoRegistrado & {
  encerrado: boolean;
  // Total movimentado (dado de Movimentações), sem o par estornada + espelho.
  saidasCentavos: number;
  entradasCentavos: number;
};

export type FiltroDeProjetos = 'em-andamento' | 'encerrados' | 'todos';

type Totais = Map<string, { saidasCentavos: number; entradasCentavos: number }>;

function comTotais(projeto: ProjetoRegistrado, totais: Totais): ProjetoComTotais {
  const doProjeto = totais.get(projeto.id) ?? { saidasCentavos: 0, entradasCentavos: 0 };
  return { ...projeto, encerrado: estaEncerrado(projeto.situacao), ...doProjeto };
}

@Injectable()
export class ListarProjetos {
  constructor(
    private readonly projetos: ProjetosRepositorio,
    private readonly totais: TotaisPorVinculo,
  ) {}

  // Passo 2: em andamento separados dos encerrados, com o total movimentado e o orçamento previsto.
  async executar(filtro: FiltroDeProjetos = 'em-andamento'): Promise<ProjetoComTotais[]> {
    const [todos, totais] = await Promise.all([this.projetos.listar(), this.totais.movimentadoPorProjeto()]);
    return todos
      .map((projeto) => comTotais(projeto, totais))
      .filter((projeto) => (filtro === 'todos' ? true : filtro === 'encerrados' ? projeto.encerrado : !projeto.encerrado));
  }
}

@Injectable()
export class CriarProjeto {
  constructor(
    private readonly projetos: ProjetosRepositorio,
    private readonly totais: TotaisPorVinculo,
  ) {}

  executar(entrada: EntradaDoProjeto, autorId: string, hoje = hojeEmSaoPaulo()): Promise<ProjetoComTotais> {
    return traduzirErrosDoCadastro(async () => {
      const criado = await this.projetos.criar(lerDadosParaInclusao(entrada), hoje.slice(0, 4), autorId);
      return comTotais(criado, await this.totais.movimentadoPorProjeto());
    });
  }
}

// Inclui o encerramento (fluxo A1): mudar a situação para executado ou cancelado. Projeto encerrado
// continua recebendo movimentações (fluxo E1), por isso continua editável.
@Injectable()
export class AlterarProjeto {
  constructor(
    private readonly projetos: ProjetosRepositorio,
    private readonly totais: TotaisPorVinculo,
  ) {}

  executar(id: string, entrada: EntradaDoProjeto, autorId: string): Promise<ProjetoComTotais> {
    return traduzirErrosDoCadastro(async () => {
      const atual = await this.projetos.buscarPorId(id);
      if (atual === null) throw new NotFoundException('Projeto não encontrado. Atualize a lista e tente de novo.');
      const alterado = await this.projetos.alterar(id, lerDadosParaAlteracao(entrada, atual), autorId);
      return comTotais(alterado, await this.totais.movimentadoPorProjeto());
    });
  }
}
