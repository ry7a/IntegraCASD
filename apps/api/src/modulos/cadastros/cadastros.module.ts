import { Module } from '@nestjs/common';
import { AlunosController } from './api/alunos.controller.js';
import { ListarAlunosAtivos } from './aplicacao/listar-alunos-ativos.js';
import { AlunosRepositorio } from './infra/alunos.repositorio.js';

// Módulo Cadastros: por enquanto, só alunos. Ainda não exporta nada; quando
// outro módulo precisar de alunos, o caso de uso entra em `exports`.
@Module({
  controllers: [AlunosController],
  providers: [ListarAlunosAtivos, AlunosRepositorio],
})
export class CadastrosModule {}
