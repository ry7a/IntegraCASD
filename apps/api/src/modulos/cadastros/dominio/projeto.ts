// Regras do cadastro de projetos [Cadastros.RF005]. Só TypeScript puro.
// Datas no formato "AAAA-MM-DD": comparar esses textos dá a mesma ordem que comparar as datas.
import { DadoInvalido, lerData, proximoCodigoDoAno, texto } from './comum.js';

// MER, decisão 5: os 5 status da planilha. A tela agrupa os três primeiros como "em andamento" e os
// dois últimos como "encerrados".
export type SituacaoDoProjeto = 'A_LIBERAR' | 'LIBERADO' | 'EM_EXECUCAO' | 'EXECUTADO' | 'CANCELADO';
const SITUACOES: SituacaoDoProjeto[] = ['A_LIBERAR', 'LIBERADO', 'EM_EXECUCAO', 'EXECUTADO', 'CANCELADO'];

export function estaEncerrado(situacao: SituacaoDoProjeto): boolean {
  return situacao === 'EXECUTADO' || situacao === 'CANCELADO';
}

export type DadosDoProjeto = {
  nome: string;
  // Opcional (MER: o responsável nem sempre é conhecido na planilha).
  responsavel: string | null;
  dataInicio: string;
  dataFim: string | null;
  // Nulo = sem orçamento previsto.
  orcamentoPrevistoCentavos: number | null;
  situacao: SituacaoDoProjeto;
};

export type EntradaDoProjeto = Partial<Record<keyof DadosDoProjeto, unknown>>;

function lerNome(valor: unknown): string {
  const nome = texto(valor, 'no nome do projeto', 120);
  if (nome === null || nome.length < 3) throw new DadoInvalido('Informe o nome do projeto, por exemplo "Reforma da sala de estudos".');
  return nome;
}

function lerResponsavel(valor: unknown): string | null {
  return texto(valor, 'no responsável', 120);
}

function lerOrcamento(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 0) {
    throw new DadoInvalido('Informe o orçamento em centavos, como número inteiro (ex.: 500000 para R$ 5.000,00), ou deixe em branco.');
  }
  return valor;
}

function lerFim(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  return lerData(valor, 'data de término');
}

function lerSituacao(valor: unknown): SituacaoDoProjeto {
  const situacao = SITUACOES.find((permitida) => permitida === valor);
  if (situacao === undefined) throw new DadoInvalido('Escolha a situação: a liberar, liberado, em execução, executado ou cancelado.');
  return situacao;
}

function conferirPeriodo(dataInicio: string, dataFim: string | null): void {
  if (dataFim !== null && dataFim < dataInicio) throw new DadoInvalido('A data de término não pode ser anterior à data de início.');
}

export function lerDadosParaInclusao(entrada: EntradaDoProjeto): DadosDoProjeto {
  const dados: DadosDoProjeto = {
    nome: lerNome(entrada.nome),
    responsavel: lerResponsavel(entrada.responsavel),
    dataInicio: lerData(entrada.dataInicio, 'data de início'),
    dataFim: lerFim(entrada.dataFim),
    orcamentoPrevistoCentavos: lerOrcamento(entrada.orcamentoPrevistoCentavos),
    situacao: entrada.situacao === undefined ? 'A_LIBERAR' : lerSituacao(entrada.situacao),
  };
  conferirPeriodo(dados.dataInicio, dados.dataFim);
  return dados;
}

// Na alteração, campo ausente (undefined) não muda. Fluxo A1: encerrar é mudar a situação para
// executado ou cancelado.
export function lerDadosParaAlteracao(
  entrada: EntradaDoProjeto,
  atual: Pick<DadosDoProjeto, 'dataInicio' | 'dataFim'>,
): Partial<DadosDoProjeto> {
  const dados: Partial<DadosDoProjeto> = {};
  if (entrada.nome !== undefined) dados.nome = lerNome(entrada.nome);
  if (entrada.responsavel !== undefined) dados.responsavel = lerResponsavel(entrada.responsavel);
  if (entrada.dataInicio !== undefined) dados.dataInicio = lerData(entrada.dataInicio, 'data de início');
  if (entrada.dataFim !== undefined) dados.dataFim = lerFim(entrada.dataFim);
  if (entrada.orcamentoPrevistoCentavos !== undefined) dados.orcamentoPrevistoCentavos = lerOrcamento(entrada.orcamentoPrevistoCentavos);
  if (entrada.situacao !== undefined) dados.situacao = lerSituacao(entrada.situacao);
  conferirPeriodo(dados.dataInicio ?? atual.dataInicio, dados.dataFim === undefined ? atual.dataFim : dados.dataFim);
  return dados;
}

// MER, regra 7: ano + "P" + sequência.
export function proximoCodigo(ano: string, codigosDoAno: string[]): string {
  return proximoCodigoDoAno(ano, 'P', codigosDoAno);
}
