import { Injectable } from '@nestjs/common';
import type { SituacaoAluno } from '../../../generated/prisma/enums.js';
import { AlunosRepositorio } from '../infra/alunos.repositorio.js';

export type AlunoResumo = {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  turma: string | null;
  situacao: SituacaoAluno | null;
};

// Caso de uso [Cadastros.RF001]: lista os alunos ativos, em ordem alfabética.
@Injectable()
export class ListarAlunosAtivos {
  constructor(private readonly alunos: AlunosRepositorio) {}

  async executar(): Promise<AlunoResumo[]> {
    const registros = await this.alunos.listarAtivos();
    return registros.map((aluno) => ({
      id: aluno.id,
      nome: aluno.nome,
      cpf: aluno.cpf,
      email: aluno.email,
      turma: aluno.turma?.nome ?? null,
      situacao: aluno.situacao,
    }));
  }
}
