import { Injectable, Logger } from '@nestjs/common';
import { ClienteAsaas, ErroAsaas } from '../../../compartilhado/asaas/cliente-asaas.js';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import { AgendadorDeRotinas, ROTINA_GERACAO_RECORRENTE } from '../../../compartilhado/fila/agendador-de-rotinas.js';
import { geracaoAPartirDeDoAmbiente } from '../../../compartilhado/geracao-a-partir-de.js';
import { BuscarParametrosVigentes } from '../../administracao/index.js';
import { ListarAlunos } from '../../cadastros/index.js';
import {
  deveGerarAgora,
  descricaoDaMensalidade,
  motivoDaReferenciaBloqueada,
  motivoDoCadastroIncompleto,
  referenciaDoCiclo,
  referenciaLiberada,
  vencimentoDaMensalidade,
  type FalhaDaGeracao,
} from '../dominio/geracao-recorrente.js';
import { CobrancasRepositorio } from '../infra/cobrancas.repositorio.js';
import { ExecucoesRepositorio, type OrigemDaExecucao, type ResultadoDaExecucao } from '../infra/execucoes.repositorio.js';
import { RitmoDoAsaas } from '../infra/ritmo-do-asaas.js';
import { GarantirClienteAsaas } from './garantir-cliente-asaas.js';

// Nova tentativa depois de o Asaas parar de responder (fluxo E1).
const NOVA_TENTATIVA_EM_SEGUNDOS = 60 * 60;

// Caso de uso [Cobranças.RF001]: gera as mensalidades do mês para os alunos ativos, sem intervenção
// humana. Roda no worker (rotina agendada) e é segura para rodar várias vezes: quem já tem a
// mensalidade do mês é pulado (fluxo A1), e o banco recusa uma segunda mensalidade do mesmo mês.
@Injectable()
export class GerarCobrancasRecorrentes {
  private readonly logger = new Logger(GerarCobrancasRecorrentes.name);

  constructor(
    private readonly cobrancas: CobrancasRepositorio,
    private readonly execucoes: ExecucoesRepositorio,
    private readonly asaas: ClienteAsaas,
    private readonly listarAlunos: ListarAlunos,
    private readonly parametros: BuscarParametrosVigentes,
    private readonly garantirClienteAsaas: GarantirClienteAsaas,
    private readonly agendador: AgendadorDeRotinas,
    private readonly ritmo: RitmoDoAsaas,
  ) {}

  // Devolve o resultado, ou nulo quando não havia o que fazer (antes do dia de geração, mês já gerado,
  // mês anterior à trava GERACAO_A_PARTIR_DE). `aPartirDe` vem do .env, lido a cada execução.
  async executar(
    origem: OrigemDaExecucao,
    hoje = hojeEmSaoPaulo(),
    aPartirDe = geracaoAPartirDeDoAmbiente(),
  ): Promise<ResultadoDaExecucao | null> {
    const parametros = await this.parametros.executar();
    if (parametros === null) {
      this.logger.warn('Geração recorrente não executada: os parâmetros de cobrança ainda não foram cadastrados.');
      return null;
    }
    const referencia = referenciaDoCiclo(hoje, parametros.diaGeracao);
    if (referencia === null) return null;
    // Antes de iniciar a execução: um registro aqui faria a rotina pular o mês certo depois.
    if (aPartirDe !== null && !referenciaLiberada(referencia, aPartirDe)) {
      this.logger.warn(`Geração recorrente de ${referencia} não executada: ${motivoDaReferenciaBloqueada(aPartirDe)}`);
      return null;
    }
    // A rotina agendada roda todo dia; só gera no dia de geração (ou depois, se perdeu o dia) e uma
    // vez por mês, salvo interrupção. O pedido manual sempre roda: serve para gerar os pendentes.
    if (origem === 'AGENDADA' && !deveGerarAgora(hoje, parametros.diaGeracao, await this.execucoes.ultimaDoMes(referencia))) {
      return null;
    }

    const execucaoId = await this.execucoes.iniciar(referencia, origem);
    const resultado: ResultadoDaExecucao = { totalCriadas: 0, totalJaExistentes: 0, totalFalhas: 0, falhas: [], interrompida: false };
    const falhar = (falha: FalhaDaGeracao) => {
      resultado.falhas.push(falha);
      resultado.totalFalhas += 1;
    };

    for (const aluno of await this.listarAlunos.executar('ativos')) {
      if (await this.cobrancas.existeMensalidade(aluno.id, referencia)) {
        resultado.totalJaExistentes += 1;
        continue;
      }
      if (aluno.cadastroIncompleto) {
        falhar({ alunoId: aluno.id, alunoNome: aluno.nome, motivo: motivoDoCadastroIncompleto(aluno.email) });
        continue;
      }

      let criada;
      try {
        const clienteIdAsaas = await this.garantirClienteAsaas.executar(aluno);
        criada = await this.asaas.criarCobranca({
          clienteIdAsaas,
          valorEmCentavos: parametros.valorMensalidadeCentavos,
          vencimento: vencimentoDaMensalidade(referencia, parametros.diaVencimento, hoje),
          descricao: descricaoDaMensalidade(referencia),
          multaPercentual: parametros.multaPercentual,
          jurosMensalPercentual: parametros.jurosMensalPercentual,
          referenciaExterna: `mensalidade:${aluno.id}:${referencia}`,
        });
      } catch (erro) {
        if (erro instanceof ErroAsaas && erro.motivo === 'DADOS_RECUSADOS') {
          // Problema só deste aluno: anota e segue.
          falhar({ alunoId: aluno.id, alunoNome: aluno.nome, motivo: erro.message });
          continue;
        }
        if (erro instanceof ErroAsaas) {
          // Fluxo E1: o Asaas parou (ou recusou a chave). Para tudo; o que já foi criado fica.
          resultado.interrompida = true;
          falhar({ alunoId: '', alunoNome: 'Geração interrompida', motivo: erro.message });
          break;
        }
        throw erro;
      }

      try {
        await this.cobrancas.registrar(
          {
            idAsaas: criada.idAsaas,
            alunoId: aluno.id,
            origem: 'MENSALIDADE',
            referencia,
            descricao: descricaoDaMensalidade(referencia),
            valorCentavos: parametros.valorMensalidadeCentavos,
            vencimento: vencimentoDaMensalidade(referencia, parametros.diaVencimento, hoje),
            multaPercentual: parametros.multaPercentual,
            jurosMensalPercentual: parametros.jurosMensalPercentual,
            urlBoleto: criada.urlBoleto,
            urlFatura: criada.urlFatura,
          },
          null,
        );
        resultado.totalCriadas += 1;
      } catch {
        // Fluxo E2: criada no Asaas, não gravada aqui. A sincronização acha pela referência externa.
        this.logger.error(`Mensalidade ${criada.idAsaas} criada no Asaas, mas não gravada aqui.`);
        falhar({
          alunoId: aluno.id,
          alunoNome: aluno.nome,
          motivo: `Criada no Asaas (${criada.idAsaas}), mas não registrada aqui. A sincronização com o Asaas corrige.`,
        });
      }
      await this.ritmo.aguardar();
    }

    await this.execucoes.finalizar(execucaoId, resultado);
    if (resultado.interrompida) {
      await this.agendador.executarDepois(ROTINA_GERACAO_RECORRENTE, NOVA_TENTATIVA_EM_SEGUNDOS, { origem: 'AGENDADA' });
    }
    return resultado;
  }
}
