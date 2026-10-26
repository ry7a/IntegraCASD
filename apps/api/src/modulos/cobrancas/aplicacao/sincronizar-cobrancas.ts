import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClienteAsaas, ErroAsaas, type CobrancaNoAsaas } from '../../../compartilhado/asaas/cliente-asaas.js';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { BuscarParametrosVigentes } from '../../administracao/index.js';
import { decidirConciliacao } from '../dominio/conciliacao.js';
import {
  avisoDaSituacaoNoAsaas,
  encargosDentroDosLimites,
  lerPeriodo,
  lerReferenciaDeMensalidade,
} from '../dominio/sincronizacao.js';
import { ConciliacaoConcorrente, ConciliacaoRepositorio, type CobrancaParaConciliar } from '../infra/conciliacao.repositorio.js';
import { RitmoDoAsaas } from '../infra/ritmo-do-asaas.js';
import {
  SincronizacaoRepositorio,
  type ExecucaoDaSincronizacao,
  type NovaExecucao,
  type ResumoDaSincronizacao,
} from '../infra/sincronizacao.repositorio.js';

// O controller usa o tipo do resultado; importa daqui, sem conhecer a infra (B2).
export type { ExecucaoDaSincronizacao };
import { buscarDestinoDaBaixa } from './destino-da-baixa.js';
import { traduzirErrosDaCobranca } from './erros-da-cobranca.js';

// Contagens de uma sincronização em andamento, mais as cobranças conferidas (para marcar a data).
type Andamento = ResumoDaSincronizacao & { conferidasIds: string[]; hoje: string; autorId: string | null };

// Caso de uso [Cobranças.RF007]: consulta o Asaas e corrige aqui o que divergir. A decisão sobre
// cada cobrança é a mesma da conciliação (dominio/conciliacao.ts), e o efeito é aplicado pela mesma
// transação: a sincronização é um "webhook atrasado" que o sistema pede.
@Injectable()
export class SincronizarCobrancas {
  private readonly logger = new Logger(SincronizarCobrancas.name);

  constructor(
    private readonly asaas: ClienteAsaas,
    private readonly conciliacao: ConciliacaoRepositorio,
    private readonly sincronizacoes: SincronizacaoRepositorio,
    private readonly parametros: BuscarParametrosVigentes,
    private readonly ritmo: RitmoDoAsaas,
  ) {}

  // Fluxo principal: todas as cobranças com vencimento no período.
  periodo(
    entrada: { vencimentoDe?: unknown; vencimentoAte?: unknown },
    origem: 'AGENDADA' | 'MANUAL',
    autorId: string | null,
    hoje = hojeEmSaoPaulo(),
  ): Promise<ExecucaoDaSincronizacao> {
    return traduzirErrosDaCobranca(async () => {
      const periodo = lerPeriodo(entrada);
      return this.executar({ origem, ...periodo, pedidaPorId: autorId }, hoje, async (andamento) => {
        const noAsaas = await this.asaas.listarCobrancas(periodo);
        const locais = new Map(
          (await this.sincronizacoes.cobrancasDoPeriodo(periodo.vencimentoDe, periodo.vencimentoAte)).map((c) => [c.idAsaas, c]),
        );
        const vistasNoAsaas = new Set<string>();
        for (const cobrancaNoAsaas of noAsaas) {
          vistasNoAsaas.add(cobrancaNoAsaas.idAsaas);
          // Pode estar aqui com outro vencimento (fora do período): procura pelo id antes de criar.
          const local = locais.get(cobrancaNoAsaas.idAsaas) ?? (await this.conciliacao.buscarCobranca(cobrancaNoAsaas.idAsaas));
          if (local === null) await this.trazerDoAsaas(cobrancaNoAsaas, andamento);
          else await this.conciliar(local, cobrancaNoAsaas, andamento);
        }
        // Daqui, mas fora da lista do Asaas: excluídas lá (a lista não traz excluídas) ou com vencimento
        // alterado lá. Só as abertas importam; as demais já não mudam pela conciliação.
        for (const local of locais.values()) {
          if (vistasNoAsaas.has(local.idAsaas)) continue;
          if (local.situacao !== 'ABERTA') {
            andamento.conferidas += 1;
            andamento.conferidasIds.push(local.id);
            continue;
          }
          await this.ritmo.aguardar();
          await this.conciliar(local, await this.asaas.buscarCobranca(local.idAsaas), andamento);
        }
      });
    });
  }

  // Fluxo A1: só uma cobrança, a partir do detalhe dela.
  cobranca(id: string, autorId: string, hoje = hojeEmSaoPaulo()): Promise<ExecucaoDaSincronizacao> {
    return traduzirErrosDaCobranca(async () => {
      const local = await this.conciliacao.buscarCobrancaPorId(id);
      if (local === null) throw new NotFoundException('Cobrança não encontrada. Volte à lista e escolha outra cobrança.');
      return this.executar({ origem: 'MANUAL', cobrancaId: id, pedidaPorId: autorId }, hoje, async (andamento) => {
        await this.conciliar(local, await this.asaas.buscarCobranca(local.idAsaas), andamento);
      });
    });
  }

  // Registra a execução, roda o trabalho e grava o resumo, mesmo se o Asaas cair no meio
  // ([Confiabilidade.NF007]). Com o Asaas fora do ar, o erro segue para quem pediu (502 na tela).
  private async executar(
    execucao: NovaExecucao,
    hoje: string,
    trabalho: (andamento: Andamento) => Promise<void>,
  ): Promise<ExecucaoDaSincronizacao> {
    const id = await this.sincronizacoes.iniciar(execucao);
    const andamento: Andamento = {
      conferidas: 0,
      atualizadas: 0,
      somenteNoAsaas: 0,
      naoIdentificadas: 0,
      paraConferir: 0,
      falha: null,
      conferidasIds: [],
      hoje,
      autorId: execucao.pedidaPorId,
    };
    // O erro que interrompeu o trabalho: a execução é finalizada com o motivo e o erro segue adiante.
    let interrupcao: unknown = null;
    try {
      await trabalho(andamento);
    } catch (erro) {
      interrupcao = erro;
      andamento.falha = `Interrompida: ${erro instanceof ErroAsaas ? erro.message : 'erro inesperado; veja o log do servidor.'}`;
    }
    await this.sincronizacoes.marcarSincronizadas(andamento.conferidasIds, new Date());
    const resumo: ResumoDaSincronizacao = {
      conferidas: andamento.conferidas,
      atualizadas: andamento.atualizadas,
      somenteNoAsaas: andamento.somenteNoAsaas,
      naoIdentificadas: andamento.naoIdentificadas,
      paraConferir: andamento.paraConferir,
      falha: andamento.falha,
    };
    const finalizada = await this.sincronizacoes.finalizar(id, resumo);
    this.logger.log(
      `Sincronização: ${resumo.conferidas} conferidas, ${resumo.atualizadas} atualizadas, ${resumo.somenteNoAsaas} trazidas do Asaas, ` +
        `${resumo.naoIdentificadas} não identificadas, ${resumo.paraConferir} para conferir.${resumo.falha ? ` ${resumo.falha}` : ''}`,
    );
    if (interrupcao !== null) throw interrupcao;
    return finalizada;
  }

  // Uma cobrança daqui contra o que o Asaas diz dela (nulo = o Asaas não a conhece).
  private async conciliar(local: CobrancaParaConciliar, noAsaas: CobrancaNoAsaas | null, andamento: Andamento): Promise<void> {
    andamento.conferidas += 1;
    andamento.conferidasIds.push(local.id);
    if (noAsaas === null) {
      if (local.situacao === 'ABERTA') andamento.paraConferir += 1;
      return;
    }
    const acao = decidirConciliacao(avisoDaSituacaoNoAsaas(noAsaas), local, andamento.hoje);
    if (acao.tipo === 'PENDENCIA') {
      andamento.paraConferir += 1;
      return;
    }
    if (acao.tipo === 'NADA') return;
    const destino = acao.tipo === 'BAIXAR' ? await buscarDestinoDaBaixa(this.parametros, local.origem) : null;
    if (acao.tipo === 'BAIXAR' && destino === null) {
      andamento.falha =
        'Há pagamentos no Asaas que não foram baixados: falta escolher a conta de recebimento e as categorias em Administração > Parâmetros.';
      return;
    }
    try {
      await this.conciliacao.aplicar(null, local, acao, destino, andamento.autorId);
      if (acao.tipo !== 'MARCAR_DISPONIVEL') andamento.atualizadas += 1;
    } catch (erro) {
      // O webhook mudou a cobrança ao mesmo tempo: a situação já está sendo corrigida por ele.
      if (!(erro instanceof ConciliacaoConcorrente)) throw erro;
    }
  }

  // Cobrança que só existe no Asaas. Mensalidade da geração recorrente é reconhecida pela referência
  // externa; as demais, pelo cliente do Asaas de um aluno. Sem aluno, não há como registrar aqui.
  private async trazerDoAsaas(noAsaas: CobrancaNoAsaas, andamento: Andamento): Promise<void> {
    if (noAsaas.removida) return;
    const mensalidade = lerReferenciaDeMensalidade(noAsaas.referenciaExterna);
    let alunoId: string | null;
    if (mensalidade !== null) {
      alunoId = (await this.sincronizacoes.alunoExiste(mensalidade.alunoId)) ? mensalidade.alunoId : null;
      if (alunoId !== null && (await this.sincronizacoes.existeMensalidade(alunoId, mensalidade.referencia))) {
        // Duas mensalidades do mesmo mês no Asaas: uma delas precisa ser cancelada lá.
        andamento.paraConferir += 1;
        return;
      }
    } else {
      alunoId = await this.sincronizacoes.alunoDoClienteAsaas(noAsaas.idCliente);
    }
    if (alunoId === null) {
      andamento.naoIdentificadas += 1;
      return;
    }
    const registrada = await this.sincronizacoes.registrarTrazidaDoAsaas(
      {
        idAsaas: noAsaas.idAsaas,
        alunoId,
        origem: mensalidade === null ? 'AVULSA' : 'MENSALIDADE',
        referencia: mensalidade?.referencia ?? null,
        descricao: (noAsaas.descricao ?? '').trim().slice(0, 200) || 'Cobrança criada no painel do Asaas',
        valorCentavos: noAsaas.valorCentavos,
        vencimento: noAsaas.vencimento,
        ...encargosDentroDosLimites(noAsaas.multaPercentual, noAsaas.jurosMensalPercentual),
        urlBoleto: noAsaas.urlBoleto,
        urlFatura: noAsaas.urlFatura,
      },
      andamento.autorId,
    );
    if (registrada === null) return;
    andamento.somenteNoAsaas += 1;
    // Já paga no Asaas? A conciliação baixa aqui também.
    await this.conciliar(registrada, noAsaas, andamento);
  }
}
