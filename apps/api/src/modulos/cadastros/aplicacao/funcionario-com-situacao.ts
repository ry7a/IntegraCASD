import { estaAtivo } from '../dominio/funcionario.js';
import type { FuncionarioRegistrado } from '../infra/funcionarios.repositorio.js';

// O funcionário com a situação calculada pela data de desligamento (fluxo A1 do [Cadastros.RF002]).
export type FuncionarioComSituacao = FuncionarioRegistrado & { ativo: boolean };
export type FiltroDeSituacaoDoFuncionario = 'ativos' | 'inativos' | 'todos';

export function comSituacao(funcionario: FuncionarioRegistrado, hoje: string): FuncionarioComSituacao {
  return { ...funcionario, ativo: estaAtivo(funcionario.dataDesligamento, hoje) };
}

export function mensagemDeCpfDuplicado(nome: string): string {
  return `Já existe um funcionário ativo com este CPF (${nome}). Abra esse cadastro para atualizá-lo.`;
}
