import { Injectable } from '@nestjs/common';
import { AlunosRepositorio } from '../infra/alunos.repositorio.js';
import type { FiltroDeSituacao } from '../infra/alunos.repositorio.js';
import { paraDetalhe, type AlunoDetalhe } from './aluno-detalhe.js';

export type { FiltroDeSituacao };

// Caso de uso [Cadastros.RF001]: lista os alunos em ordem alfabética, filtrando pela situação.
// Sem filtro, só os ativos (é o que a geração de cobranças e a tela de nova cobrança usam).
@Injectable()
export class ListarAlunos {
  constructor(private readonly alunos: AlunosRepositorio) {}

  async executar(situacao: FiltroDeSituacao = 'ativos'): Promise<AlunoDetalhe[]> {
    return (await this.alunos.listar(situacao)).map(paraDetalhe);
  }
}
