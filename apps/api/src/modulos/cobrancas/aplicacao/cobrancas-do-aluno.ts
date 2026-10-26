import { Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { CobrancasRepositorio, type TotaisDoAluno } from '../infra/cobrancas.repositorio.js';
import { paraItemDaLista, type ItemDaLista } from './consultar-cobrancas.js';

export type { TotaisDoAluno };

export type CobrancasDoAluno = {
  itens: ItemDaLista[];
  // Abertas, vencidas ou não.
  totalEmAbertoCentavos: number;
  quantidadeVencidas: number;
  totalVencidoCentavos: number;
};

// Totais de uma lista de cobranças já com a situação exibida (VENCIDA calculada). Puro, para o teste.
export function totalizar(itens: ItemDaLista[]): Omit<CobrancasDoAluno, 'itens'> {
  const emAberto = itens.filter((item) => item.situacao === 'ABERTA' || item.situacao === 'VENCIDA');
  const vencidas = itens.filter((item) => item.situacao === 'VENCIDA');
  const somar = (lista: ItemDaLista[]) => lista.reduce((soma, item) => soma + item.valorCentavos, 0);
  return {
    totalEmAbertoCentavos: somar(emAberto),
    quantidadeVencidas: vencidas.length,
    totalVencidoCentavos: somar(vencidas),
  };
}

// Caso de uso [Cadastros.RF001]: aba Cobranças do aluno e aviso de débito ao inativar (fluxo E2).
@Injectable()
export class ListarCobrancasDoAluno {
  constructor(private readonly cobrancas: CobrancasRepositorio) {}

  async executar(alunoId: string, hoje = hojeEmSaoPaulo()): Promise<CobrancasDoAluno> {
    const itens = (await this.cobrancas.listarDoAluno(alunoId)).map((cobranca) => paraItemDaLista(cobranca, hoje));
    return { itens, ...totalizar(itens) };
  }
}

// Coluna "Em aberto" da lista de alunos: só os alunos com alguma cobrança aberta.
@Injectable()
export class TotaisEmAbertoPorAluno {
  constructor(private readonly cobrancas: CobrancasRepositorio) {}

  executar(hoje = hojeEmSaoPaulo()): Promise<TotaisDoAluno[]> {
    return this.cobrancas.totaisEmAbertoPorAluno(hoje);
  }
}
