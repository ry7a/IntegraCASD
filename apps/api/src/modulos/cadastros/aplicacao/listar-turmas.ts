import { Injectable } from '@nestjs/common';
import { AlunosRepositorio } from '../infra/alunos.repositorio.js';

// Caso de uso: as turmas já cadastradas, da mais recente para a mais antiga (sugestões do formulário).
@Injectable()
export class ListarTurmas {
  constructor(private readonly alunos: AlunosRepositorio) {}

  executar(): Promise<string[]> {
    return this.alunos.listarTurmas();
  }
}
