import { Injectable, NotFoundException } from '@nestjs/common';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { lerResolucaoDaPendencia } from '../dominio/conciliacao.js';
import type { FalhaDaGeracao } from '../dominio/geracao-recorrente.js';
import { ExecucoesRepositorio, type ExecucaoRegistrada } from '../infra/execucoes.repositorio.js';
import { PendenciasRepositorio, type PendenciaRegistrada } from '../infra/pendencias.repositorio.js';
import { traduzirErrosDaCobranca } from './erros-da-cobranca.js';

export type { PendenciaRegistrada };

export type FalhaAtualDaGeracao = FalhaDaGeracao & { referencia: string; ocorridaEm: Date };

export type FilaDePendencias = {
  itens: PendenciaRegistrada[];
  // Falhas da última geração de cada mês recente: resolvem-se corrigindo o cadastro e gerando os
  // pendentes de novo (Administração > Parâmetros), não marcando aqui.
  falhasDaGeracao: FalhaAtualDaGeracao[];
};

// Das execuções, só a mais recente de cada mês (a anterior foi superada por ela), do mês passado em
// diante. Puro, para o teste.
export function falhasAtuaisDaGeracao(execucoes: ExecucaoRegistrada[], hoje: string): FalhaAtualDaGeracao[] {
  const [ano, mes] = hoje.split('-').map(Number);
  const mesPassado = mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, '0')}`;
  const maisRecentePorMes = new Map<string, ExecucaoRegistrada>();
  for (const execucao of execucoes) {
    const atual = maisRecentePorMes.get(execucao.referencia);
    if (atual === undefined || execucao.iniciadaEm > atual.iniciadaEm) maisRecentePorMes.set(execucao.referencia, execucao);
  }
  return [...maisRecentePorMes.values()]
    .filter((execucao) => execucao.referencia >= mesPassado)
    .flatMap((execucao) =>
      execucao.falhas.map((falha) => ({ ...falha, referencia: execucao.referencia, ocorridaEm: execucao.iniciadaEm })),
    );
}

// Caso de uso [Cobranças.RF005] fluxo E1 (issue #37): fila única do que precisa de conferência.
@Injectable()
export class ListarPendencias {
  constructor(
    private readonly pendencias: PendenciasRepositorio,
    private readonly execucoes: ExecucoesRepositorio,
  ) {}

  async executar(resolvidas: boolean, hoje = hojeEmSaoPaulo()): Promise<FilaDePendencias> {
    const [itens, execucoes] = await Promise.all([this.pendencias.listar(!resolvidas), this.execucoes.ultimas(12)]);
    return { itens, falhasDaGeracao: resolvidas ? [] : falhasAtuaisDaGeracao(execucoes, hoje) };
  }
}

@Injectable()
export class ResolverPendencia {
  constructor(private readonly pendencias: PendenciasRepositorio) {}

  executar(id: string, entrada: { resolucao?: unknown }, autorId: string): Promise<void> {
    return traduzirErrosDaCobranca(async () => {
      const resolucao = lerResolucaoDaPendencia(entrada.resolucao);
      if (!(await this.pendencias.resolver(id, resolucao, autorId))) {
        throw new NotFoundException('Esta pendência não está mais aberta. Atualize a página.');
      }
    });
  }
}
