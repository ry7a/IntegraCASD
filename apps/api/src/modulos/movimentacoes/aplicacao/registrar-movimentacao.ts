import { BadRequestException, Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { estaEncerrado, type SituacaoDoProjeto } from '../../../compartilhado/situacao-do-projeto.js';
import { MovimentacaoInvalida, conferirCategoria, lerNovaMovimentacao, type NovaMovimentacao } from '../dominio/movimentacao.js';
import { MovimentacoesRepositorio } from '../infra/movimentacoes.repositorio.js';

export type MovimentacaoRegistradaAgora = {
  id: string;
  // Fluxo A2: o lançamento em projeto encerrado é aceito, mas a tela avisa.
  aviso: string | null;
};

// [Movimentações.RF001] A2 e [Cadastros.RF005] E1: em projeto encerrado o lançamento é aceito e sinalizado.
// "Encerrado" (executado ou cancelado) é a mesma definição que a lista de projetos do Cadastros usa
// (compartilhado/situacao-do-projeto.ts).
function avisoDoProjeto(situacao: SituacaoDoProjeto | null): string | null {
  if (situacao === null || !estaEncerrado(situacao)) return null;
  return 'Movimentação registrada em projeto encerrado (projeto já executado ou cancelado). Confira se o projeto deve ser reaberto.';
}

// Caso de uso [Movimentações.RF001]: lança uma entrada ou saída manual.
@Injectable()
export class RegistrarMovimentacao {
  constructor(private readonly movimentacoes: MovimentacoesRepositorio) {}

  async executar(
    entrada: Partial<Record<keyof NovaMovimentacao, unknown>>,
    autorId: string,
    hoje = hojeEmSaoPaulo(),
  ): Promise<MovimentacaoRegistradaAgora> {
    try {
      const nova = lerNovaMovimentacao(entrada, hoje);
      const referencias = await this.movimentacoes.referenciasDoRegistro(nova);
      conferirCategoria(nova.tipo, referencias.categoria);
      if (!referencias.contaAtiva) throw new MovimentacaoInvalida('A conta não foi encontrada ou está inativa. Escolha outra na lista.');
      if (!referencias.vinculoEncontrado) {
        throw new MovimentacaoInvalida('O contrato, projeto ou funcionário escolhido não foi encontrado. Escolha de novo na lista.');
      }
      const id = await this.movimentacoes.registrar(nova, autorId);
      return { id, aviso: avisoDoProjeto(referencias.situacaoDoProjeto) };
    } catch (erro) {
      if (erro instanceof MovimentacaoInvalida) throw new BadRequestException(erro.message);
      throw erro;
    }
  }
}
