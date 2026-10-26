import { Module } from '@nestjs/common';
import { AlunosController, TurmasController } from './api/alunos.controller.js';
import { FuncionariosController } from './api/funcionarios.controller.js';
import { AlterarAluno } from './aplicacao/alterar-aluno.js';
import { AlterarFuncionario } from './aplicacao/alterar-funcionario.js';
import { BuscarAluno } from './aplicacao/buscar-aluno.js';
import { CriarAluno } from './aplicacao/criar-aluno.js';
import { CriarFuncionario } from './aplicacao/criar-funcionario.js';
import { ListarAlunos } from './aplicacao/listar-alunos.js';
import { ListarFuncionarios } from './aplicacao/listar-funcionarios.js';
import { ListarTurmas } from './aplicacao/listar-turmas.js';
import { AlunosRepositorio } from './infra/alunos.repositorio.js';
import { FuncionariosRepositorio } from './infra/funcionarios.repositorio.js';

// Módulo Cadastros: alunos, turmas e funcionários. Ainda não exporta nada; quando
// outro módulo precisar de algo daqui, o caso de uso entra em `exports`.
@Module({
  controllers: [AlunosController, TurmasController, FuncionariosController],
  providers: [
    ListarAlunos,
    BuscarAluno,
    CriarAluno,
    AlterarAluno,
    ListarTurmas,
    AlunosRepositorio,
    ListarFuncionarios,
    CriarFuncionario,
    AlterarFuncionario,
    FuncionariosRepositorio,
  ],
})
export class CadastrosModule {}
