// Regras do cadastro de contratos [Cadastros.RF004]. Só TypeScript puro.
// Datas no formato "AAAA-MM-DD": comparar esses textos dá a mesma ordem que comparar as datas.
import { DadoInvalido, lerData, proximoCodigoDoAno, texto } from './comum.js';

export type Periodicidade = 'MENSAL' | 'ANUAL' | 'POR_DEMANDA' | 'UNICA';
const PERIODICIDADES: Periodicidade[] = ['MENSAL', 'ANUAL', 'POR_DEMANDA', 'UNICA'];

export type DadosDoContrato = {
  // Nome de quem contratamos: texto livre, não há cadastro de fornecedores.
  contraparte: string;
  objeto: string;
  // Valor previsto por periodicidade, em centavos.
  valorCentavos: number;
  periodicidade: Periodicidade;
  dataInicio: string;
  // Nulo = prazo indeterminado.
  dataFim: string | null;
};

export type EntradaDoContrato = Partial<Record<keyof DadosDoContrato, unknown>>;

function lerTexto(valor: unknown, campo: string, exemplo: string, maximo: number): string {
  const lido = texto(valor);
  if (lido === null || lido.length < 2) throw new DadoInvalido(`Informe ${campo}, por exemplo "${exemplo}".`);
  if (lido.length > maximo) throw new DadoInvalido(`Use no máximo ${maximo} caracteres em ${campo}.`);
  return lido;
}

function lerValor(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 0) {
    throw new DadoInvalido('Informe o valor em centavos, como número inteiro (ex.: 120000 para R$ 1.200,00).');
  }
  return valor;
}

function lerPeriodicidade(valor: unknown): Periodicidade {
  const encontrada = PERIODICIDADES.find((periodicidade) => periodicidade === valor);
  if (encontrada === undefined) throw new DadoInvalido('Escolha a periodicidade: mensal, anual, por demanda ou única.');
  return encontrada;
}

function lerFim(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  return lerData(valor, 'data de término');
}

// Fluxo E1: término antes do início é recusado, indicando o campo.
function conferirVigencia(dataInicio: string, dataFim: string | null): void {
  if (dataFim !== null && dataFim < dataInicio) {
    throw new DadoInvalido('A data de término não pode ser anterior à data de início.');
  }
}

export function lerDadosParaInclusao(entrada: EntradaDoContrato): DadosDoContrato {
  const dados: DadosDoContrato = {
    contraparte: lerTexto(entrada.contraparte, 'a contraparte', 'Limpeza Fictícia Ltda.', 120),
    objeto: lerTexto(entrada.objeto, 'o objeto do contrato', 'Limpeza semanal do prédio', 200),
    valorCentavos: lerValor(entrada.valorCentavos),
    periodicidade: lerPeriodicidade(entrada.periodicidade),
    dataInicio: lerData(entrada.dataInicio, 'data de início'),
    dataFim: lerFim(entrada.dataFim),
  };
  conferirVigencia(dados.dataInicio, dados.dataFim);
  return dados;
}

// Na alteração, campo ausente (undefined) não muda; `dataFim: null` deixa o prazo indeterminado.
export function lerDadosParaAlteracao(
  entrada: EntradaDoContrato,
  atual: Pick<DadosDoContrato, 'dataInicio' | 'dataFim'>,
): Partial<DadosDoContrato> {
  const dados: Partial<DadosDoContrato> = {};
  if (entrada.contraparte !== undefined) dados.contraparte = lerTexto(entrada.contraparte, 'a contraparte', 'Limpeza Fictícia Ltda.', 120);
  if (entrada.objeto !== undefined) dados.objeto = lerTexto(entrada.objeto, 'o objeto do contrato', 'Limpeza semanal do prédio', 200);
  if (entrada.valorCentavos !== undefined) dados.valorCentavos = lerValor(entrada.valorCentavos);
  if (entrada.periodicidade !== undefined) dados.periodicidade = lerPeriodicidade(entrada.periodicidade);
  if (entrada.dataInicio !== undefined) dados.dataInicio = lerData(entrada.dataInicio, 'data de início');
  if (entrada.dataFim !== undefined) dados.dataFim = lerFim(entrada.dataFim);
  conferirVigencia(dados.dataInicio ?? atual.dataInicio, dados.dataFim === undefined ? atual.dataFim : dados.dataFim);
  return dados;
}

// Fluxo A1: encerramento antecipado, com a data efetiva e a justificativa.
export function lerEncerramento(
  entrada: { dataEncerramento?: unknown; justificativa?: unknown },
  dataInicio: string,
): { dataEncerramento: string; justificativa: string } {
  const dataEncerramento = lerData(entrada.dataEncerramento, 'data de encerramento');
  if (dataEncerramento < dataInicio) throw new DadoInvalido('A data de encerramento não pode ser anterior ao início do contrato.');
  const justificativa = texto(entrada.justificativa);
  if (justificativa === null || justificativa.length < 5) {
    throw new DadoInvalido('Informe a justificativa do encerramento, por exemplo: serviço passou a ser feito pela AEITA.');
  }
  if (justificativa.length > 300) throw new DadoInvalido('Use no máximo 300 caracteres na justificativa.');
  return { dataEncerramento, justificativa };
}

// Passo 2: destacar os que vencem nos próximos 60 dias.
export const DIAS_PARA_VENCER_EM_BREVE = 60;

export type SituacaoExibida = 'VIGENTE' | 'VENCE_EM_BREVE' | 'ENCERRADO';

function diasEntre(inicio: string, fim: string): number {
  const dia = (texto: string) => Date.UTC(Number(texto.slice(0, 4)), Number(texto.slice(5, 7)) - 1, Number(texto.slice(8, 10)));
  return Math.round((dia(fim) - dia(inicio)) / 86_400_000);
}

// Encerrado: pelo usuário (fluxo A1) ou porque o término já passou.
export function situacaoDoContrato(
  encerradoPeloUsuario: boolean,
  dataFim: string | null,
  hoje: string,
): { situacao: SituacaoExibida; diasParaVencer: number | null } {
  const diasParaVencer = dataFim === null ? null : diasEntre(hoje, dataFim);
  if (encerradoPeloUsuario || (diasParaVencer !== null && diasParaVencer < 0)) return { situacao: 'ENCERRADO', diasParaVencer };
  if (diasParaVencer !== null && diasParaVencer <= DIAS_PARA_VENCER_EM_BREVE) return { situacao: 'VENCE_EM_BREVE', diasParaVencer };
  return { situacao: 'VIGENTE', diasParaVencer };
}

// MER, regra 7: código no formato da planilha, ano com 2 dígitos + "C" + sequência de 3 dígitos.
export function proximoCodigo(ano: string, codigosDoAno: string[]): string {
  return proximoCodigoDoAno(ano, 'C', codigosDoAno);
}
