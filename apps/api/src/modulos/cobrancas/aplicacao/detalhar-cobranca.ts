import { Injectable, NotFoundException } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { aceitaOperacoes, diasEntre, existeNoAsaas } from '../dominio/cobranca.js';
import { sincronizacaoAntiga } from '../dominio/sincronizacao.js';
import { CobrancasRepositorio, type EventoDaCobranca } from '../infra/cobrancas.repositorio.js';
import { paraItemDaLista, type ItemDaLista } from './consultar-cobrancas.js';

export type DetalheDaCobranca = ItemDaLista & {
  // Falso só na herdada da planilha (ADR-0005): sem boleto nem sincronização.
  existeNoAsaas: boolean;
  podeCancelar: boolean;
  podeRegistrarPagamentoManual: boolean;
  diasDesdeUltimaSincronizacao: number | null;
  sincronizacaoAntiga: boolean;
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
    const noAsaas = existeNoAsaas(cobranca.origem);
    const sincronizadaEm = cobranca.sincronizadaEm === null ? null : hojeEmSaoPaulo(cobranca.sincronizadaEm);
    return {
      ...paraItemDaLista(cobranca, hoje),
      existeNoAsaas: noAsaas,
      podeCancelar: aceita,
      podeRegistrarPagamentoManual: aceita,
      diasDesdeUltimaSincronizacao: sincronizadaEm === null ? null : diasEntre(sincronizadaEm, hoje),
      // A herdada nunca é sincronizada: avisar que a sincronização é antiga só confundiria.
      sincronizacaoAntiga: noAsaas && sincronizacaoAntiga(sincronizadaEm, hoje),
      eventos: await this.cobrancas.historico(cobranca),
    };
  }
}
