import { Injectable, NotFoundException } from '@nestjs/common';
import { AlunosRepositorio } from '../infra/alunos.repositorio.js';
import { paraDetalhe, type AlunoDetalhe } from './aluno-detalhe.js';

// Caso de uso [Cadastros.RF001]: abre o cadastro de um aluno.
@Injectable()
export class BuscarAluno {
  constructor(private readonly alunos: AlunosRepositorio) {}

  async executar(id: string): Promise<AlunoDetalhe> {
    const aluno = await this.alunos.buscarPorId(id);
    if (aluno === null) throw new NotFoundException('Aluno não encontrado. Volte à lista e escolha outro cadastro.');
    return paraDetalhe(aluno);
  }
}
