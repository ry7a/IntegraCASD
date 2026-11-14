// Regras do cadastro de funcionário [Cadastros.RF002]. Só TypeScript puro: sem framework e sem banco.
// Datas no formato "AAAA-MM-DD": comparar esses textos dá a mesma ordem que comparar as datas.
import { DadoInvalido, lerData, normalizarCpf, normalizarNomeCompleto, texto } from './comum.js';

export type DadosDoFuncionario = {
  nome: string;
  cpf: string;
  cargo: string;
  salarioReferenciaCentavos: number;
  dataAdmissao: string;
  dataDesligamento: string | null;
};

export type EntradaDoFuncionario = Partial<Record<keyof DadosDoFuncionario, unknown>>;

export function normalizarCargo(valor: unknown): string {
  const cargo = texto(valor, 'no cargo', 80);
  if (cargo === null || cargo.length < 2) throw new DadoInvalido('Informe o cargo, por exemplo "Auxiliar de limpeza".');
  return cargo;
}

// O salário de referência é informativo [Cadastros.RF002]: o pagamento efetivo é uma movimentação.
// Dinheiro em centavos, como inteiro.
export function lerSalarioEmCentavos(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 0) {
    throw new DadoInvalido('Informe o salário de referência em centavos, como número inteiro (ex.: 245000 para R$ 2.450,00).');
  }
  return valor;
}

function lerDesligamento(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  return lerData(valor, 'data de desligamento');
}

function conferirPeriodo(dataAdmissao: string, dataDesligamento: string | null): void {
  if (dataDesligamento !== null && dataDesligamento < dataAdmissao) {
    throw new DadoInvalido('A data de desligamento não pode ser anterior à de admissão.');
  }
}

export function lerDadosParaInclusao(entrada: EntradaDoFuncionario): DadosDoFuncionario {
  const dados: DadosDoFuncionario = {
    nome: normalizarNomeCompleto(entrada.nome),
    cpf: normalizarCpf(entrada.cpf),
    cargo: normalizarCargo(entrada.cargo),
    salarioReferenciaCentavos: lerSalarioEmCentavos(entrada.salarioReferenciaCentavos),
    dataAdmissao: lerData(entrada.dataAdmissao, 'data de admissão'),
    dataDesligamento: lerDesligamento(entrada.dataDesligamento),
  };
  conferirPeriodo(dados.dataAdmissao, dados.dataDesligamento);
  return dados;
}

// Na alteração, campo ausente (undefined) não muda; `dataDesligamento: null` readmite.
// O período é conferido com os valores finais (o que mudou + o que já estava gravado).
export function lerDadosParaAlteracao(
  entrada: EntradaDoFuncionario,
  atual: Pick<DadosDoFuncionario, 'dataAdmissao' | 'dataDesligamento'>,
): Partial<DadosDoFuncionario> {
  const dados: Partial<DadosDoFuncionario> = {};
  if (entrada.nome !== undefined) dados.nome = normalizarNomeCompleto(entrada.nome);
  if (entrada.cpf !== undefined) dados.cpf = normalizarCpf(entrada.cpf);
  if (entrada.cargo !== undefined) dados.cargo = normalizarCargo(entrada.cargo);
  if (entrada.salarioReferenciaCentavos !== undefined) {
    dados.salarioReferenciaCentavos = lerSalarioEmCentavos(entrada.salarioReferenciaCentavos);
  }
  if (entrada.dataAdmissao !== undefined) dados.dataAdmissao = lerData(entrada.dataAdmissao, 'data de admissão');
  if (entrada.dataDesligamento !== undefined) dados.dataDesligamento = lerDesligamento(entrada.dataDesligamento);
  conferirPeriodo(dados.dataAdmissao ?? atual.dataAdmissao, dados.dataDesligamento ?? atual.dataDesligamento);
  return dados;
}

// Fluxo A1: o funcionário fica inativo a partir da data de desligamento. Antes dela, continua ativo
// (por exemplo, aviso prévio). Sem desligamento, ativo.
export function estaAtivo(dataDesligamento: string | null, hoje: string): boolean {
  return dataDesligamento === null || dataDesligamento > hoje;
}
