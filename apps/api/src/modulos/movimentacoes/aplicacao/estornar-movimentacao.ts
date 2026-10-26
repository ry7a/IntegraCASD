import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { MovimentacaoInvalida, lerMotivoDoEstorno, regraDoEstorno } from '../dominio/movimentacao.js';
import { MovimentacoesRepositorio } from '../infra/movimentacoes.repositorio.js';

// Caso de uso [Movimentações.RF002]: corrige uma movimentação manual sem apagá-la, com um lançamento
// de sinal contrário (o espelho). O efeito das duas no resultado é nulo.
@Injectable()
export class EstornarMovimentacao {
  constructor(private readonly movimentacoes: MovimentacoesRepositorio) {}

  async executar(id: string, entrada: { motivo?: unknown }, autorId: string, hoje = hojeEmSaoPaulo()): Promise<{ espelhoId: string }> {
    const original = await this.movimentacoes.paraEstornar(id);
    if (original === null) throw new NotFoundException('Movimentação não encontrada. Atualize a lista.');
    if (original.estornadaEm !== null) {
      // Fluxo E2: informa e não cria outro espelho.
      throw new ConflictException(`Esta movimentação já foi estornada em ${original.estornadaEm.split('-').reverse().join('/')}. Veja o estorno na lista.`);
    }
    const regra = regraDoEstorno(original.origem, false);
    // Fluxo E1: movimentação de cobrança (e estorno) não se estorna aqui.
    if (!regra.podeEstornar) throw new BadRequestException(regra.motivoSemEstorno);
    let motivo: string;
    try {
      motivo = lerMotivoDoEstorno(entrada.motivo);
    } catch (erro) {
      if (erro instanceof MovimentacaoInvalida) throw new BadRequestException(erro.message);
      throw erro;
    }
    const espelhoId = await this.movimentacoes.estornar(id, motivo, hoje, autorId);
    if (espelhoId === null) throw new ConflictException('Esta movimentação acabou de ser estornada por outra pessoa. Atualize a lista.');
    return { espelhoId };
  }
}
