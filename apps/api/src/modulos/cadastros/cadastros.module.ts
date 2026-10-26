import { Module } from '@nestjs/common';
import { AlunosController, TurmasController } from './api/alunos.controller.js';
import { AlterarAluno } from './aplicacao/alterar-aluno.js';
import { BuscarAluno } from './aplicacao/buscar-aluno.js';
import { CriarAluno } from './aplicacao/criar-aluno.js';
import { ListarAlunos } from './aplicacao/listar-alunos.js';
import { ListarTurmas } from './aplicacao/listar-turmas.js';
import { AlunosRepositorio } from './infra/alunos.repositorio.js';

// Módulo Cadastros: por enquanto, alunos e turmas. Ainda não exporta nada; quando
// outro módulo precisar de alunos, o caso de uso entra em `exports`.
@Module({
  controllers: [AlunosController, TurmasController],
  providers: [ListarAlunos, BuscarAluno, CriarAluno, AlterarAluno, ListarTurmas, AlunosRepositorio],
})
export class CadastrosModule {}
