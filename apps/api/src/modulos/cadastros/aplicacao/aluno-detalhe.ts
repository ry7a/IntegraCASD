import { cadastroIncompleto } from '../dominio/aluno.js';
import type { AlunoRegistrado } from '../infra/alunos.repositorio.js';

// O que os casos de uso devolvem: o aluno e a marca de cadastro incompleto (fluxo A4).
export type AlunoDetalhe = AlunoRegistrado & { cadastroIncompleto: boolean };

export function paraDetalhe(aluno: AlunoRegistrado): AlunoDetalhe {
  return { ...aluno, cadastroIncompleto: cadastroIncompleto(aluno) };
}
