import { Injectable } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import {
  diasDeAtraso,
  lerFiltrosDaConsulta,
  situacaoExibida,
  type SituacaoExibida,
} from '../dominio/cobranca.js';
import { semSincronizarHaDias } from '../dominio/sincronizacao.js';
import { CobrancasRepositorio, type CobrancaRegistrada } from '../infra/cobrancas.repositorio.js';
import { traduzirErrosDaCobranca } from './erros-da-cobranca.js';

export type ItemDaLista = Omit<CobrancaRegistrada, 'situacao'> & {
  situacao: SituacaoExibida;
  diasDeAtraso: number | null;
  // Fluxo A2: vencida sem sincronizar há mais de sete dias (nulo nos demais casos).
  semSincronizarHaDias: number | null;
};

// Converte uma cobrança gravada no que a tela mostra: situação exibida (com VENCIDA) e atraso.
export function paraItemDaLista(cobranca: CobrancaRegistrada, hoje: string): ItemDaLista {
  const situacao = situacaoExibida(cobranca.situacao, cobranca.vencimento, hoje);
  const sincronizadaEm = cobranca.sincronizadaEm === null ? null : hojeEmSaoPaulo(cobranca.sincronizadaEm);
  return {
    ...cobranca,
    situacao,
    diasDeAtraso: diasDeAtraso(situacao, cobranca.vencimento, hoje),
    semSincronizarHaDias: semSincronizarHaDias(situacao, cobranca.vencimento, sincronizadaEm, hoje),
  };
}

// Caso de uso [Cobranças.RF008]: localiza cobranças por aluno, situação, vencimento e valor.
// Não altera nada. Sem filtro de situação, abertas e vencidas, por vencimento.
@Injectable()
export class ConsultarCobrancas {
  constructor(private readonly cobrancas: CobrancasRepositorio) {}

  executar(consulta: Record<string, unknown>, hoje = hojeEmSaoPaulo()): Promise<{ itens: ItemDaLista[]; total: number }> {
    return traduzirErrosDaCobranca(async () => {
      const filtros = lerFiltrosDaConsulta(consulta);
      const { itens, total } = await this.cobrancas.listar(filtros, hoje);
      return { itens: itens.map((cobranca) => paraItemDaLista(cobranca, hoje)), total };
    });
  }
}
