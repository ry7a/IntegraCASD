import { Module } from '@nestjs/common';
import { AlunosController, TurmasController } from './api/alunos.controller.js';
import { FuncionariosController } from './api/funcionarios.controller.js';
import { AlterarAluno } from './aplicacao/alterar-aluno.js';
import { AlterarFuncionario } from './aplicacao/alterar-funcionario.js';
import { BuscarAluno } from './aplicacao/buscar-aluno.js';
import { CriarAluno } from './aplicacao/criar-aluno.js';
import { CriarFuncionario } from './aplicacao/criar-funcionario.js';
import { ListarAlunos } from './aplicacao/listar-alunos.js';
import { ListarAlunosCobraveis } from './aplicacao/listar-alunos-cobraveis.js';
import { ListarFuncionarios } from './aplicacao/listar-funcionarios.js';
import { ListarTurmas } from './aplicacao/listar-turmas.js';
import { AlunosRepositorio } from './infra/alunos.repositorio.js';
import { FuncionariosRepositorio } from './infra/funcionarios.repositorio.js';

// Módulo Cadastros: alunos, turmas e funcionários. O que outros módulos usam entra em `exports`
// (e também no index.ts, que é por onde eles importam).
@Module({
  controllers: [AlunosController, TurmasController, FuncionariosController],
  providers: [
    ListarAlunos,
    BuscarAluno,
    CriarAluno,
    AlterarAluno,
    ListarTurmas,
    ListarAlunosCobraveis,
    AlunosRepositorio,
    ListarFuncionarios,
    CriarFuncionario,
    AlterarFuncionario,
    FuncionariosRepositorio,
  ],
  exports: [ListarAlunosCobraveis, BuscarAluno, ListarAlunos],
})
export class CadastrosModule {}
