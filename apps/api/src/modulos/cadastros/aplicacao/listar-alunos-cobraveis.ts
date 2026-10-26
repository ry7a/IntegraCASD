import { Injectable } from '@nestjs/common';
import { AlunosRepositorio } from '../infra/alunos.repositorio.js';
import { paraDetalhe, type AlunoDetalhe } from './aluno-detalhe.js';

// Caso de uso exportado para outros módulos (Administração, Cobranças): os alunos que podem
// receber cobrança, isto é, ativos e com cadastro completo (CPF válido e e-mail) [Cadastros.RF001].
@Injectable()
export class ListarAlunosCobraveis {
  constructor(private readonly alunos: AlunosRepositorio) {}

  async executar(): Promise<AlunoDetalhe[]> {
    const ativos = (await this.alunos.listar('ativos')).map(paraDetalhe);
    return ativos.filter((aluno) => !aluno.cadastroIncompleto);
  }
}
