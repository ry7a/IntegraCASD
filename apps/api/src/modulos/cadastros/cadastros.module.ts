import { Module } from '@nestjs/common';
import { MovimentacoesModule } from '../movimentacoes/index.js';
import { AlunosController, TurmasController } from './api/alunos.controller.js';
import { ContratosController } from './api/contratos.controller.js';
import { ProjetosController } from './api/projetos.controller.js';
import { FuncionariosController } from './api/funcionarios.controller.js';
import { AlterarAluno } from './aplicacao/alterar-aluno.js';
import { AlterarFuncionario } from './aplicacao/alterar-funcionario.js';
import { BuscarAluno } from './aplicacao/buscar-aluno.js';
import { AlterarContrato, CriarContrato, EncerrarContrato, ListarContratos } from './aplicacao/contratos.js';
import { AlterarProjeto, CriarProjeto, ListarProjetos } from './aplicacao/projetos.js';
import { CriarAluno } from './aplicacao/criar-aluno.js';
import { CriarFuncionario } from './aplicacao/criar-funcionario.js';
import { ListarAlunos } from './aplicacao/listar-alunos.js';
import { ListarAlunosCobraveis } from './aplicacao/listar-alunos-cobraveis.js';
import { ListarFuncionarios } from './aplicacao/listar-funcionarios.js';
import { ListarTurmas } from './aplicacao/listar-turmas.js';
import { AlunosRepositorio } from './infra/alunos.repositorio.js';
import { ContratosRepositorio } from './infra/contratos.repositorio.js';
import { ProjetosRepositorio } from './infra/projetos.repositorio.js';
import { FuncionariosRepositorio } from './infra/funcionarios.repositorio.js';

// Módulo Cadastros: alunos, turmas, funcionários, contratos e projetos. O que outros módulos usam entra em `exports`
// (e também no index.ts, que é por onde eles importam).
@Module({
  // Movimentações entrega o total pago em cada contrato e projeto. O MovimentacoesModule não importa este
  // módulo (sem ciclo no Nest): do Cadastros, Movimentações só usa a regra pura `estaEncerrado`, pelo index.ts.
  // Como os dois index.ts se importam, o Cadastros carrega antes do Movimentações (a app.module já faz assim);
  // carregar o Movimentações primeiro, no Node, dá "Cannot access ... before initialization".
  imports: [MovimentacoesModule],
  controllers: [AlunosController, TurmasController, FuncionariosController, ContratosController, ProjetosController],
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
    ListarContratos,
    CriarContrato,
    AlterarContrato,
    EncerrarContrato,
    ContratosRepositorio,
    ListarProjetos,
    CriarProjeto,
    AlterarProjeto,
    ProjetosRepositorio,
  ],
  exports: [ListarAlunosCobraveis, BuscarAluno, ListarAlunos],
})
export class CadastrosModule {}
