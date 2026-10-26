import { Injectable, NotFoundException } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { aceitaOperacoes } from '../dominio/cobranca.js';
import { CobrancasRepositorio, type EventoDaCobranca } from '../infra/cobrancas.repositorio.js';
import { paraItemDaLista, type ItemDaLista } from './consultar-cobrancas.js';

export type DetalheDaCobranca = ItemDaLista & {
  podeCancelar: boolean;
  podeRegistrarPagamentoManual: boolean;
  eventos: EventoDaCobranca[];
};

// Caso de uso [Cobranças.RF008], passo 5: o detalhe da cobrança, de onde saem as operações.
@Injectable()
export class DetalharCobranca {
  constructor(private readonly cobrancas: CobrancasRepositorio) {}

  async executar(id: string, hoje = hojeEmSaoPaulo()): Promise<DetalheDaCobranca> {
    const cobranca = await this.cobrancas.buscarPorId(id);
    if (cobranca === null) throw new NotFoundException('Cobrança não encontrada. Volte à lista e escolha outra cobrança.');
    const aceita = aceitaOperacoes(cobranca.situacao);
    return {
      ...paraItemDaLista(cobranca, hoje),
      podeCancelar: aceita,
      podeRegistrarPagamentoManual: aceita,
      eventos: await this.cobrancas.historico(cobranca),
    };
  }
}
