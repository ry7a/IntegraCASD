import { Module } from '@nestjs/common';
import { CategoriasController } from './api/categorias.controller.js';
import { UsuariosController } from './api/usuarios.controller.js';
import { AlterarCategoria } from './aplicacao/alterar-categoria.js';
import { CriarCategoria } from './aplicacao/criar-categoria.js';
import { ExcluirCategoria } from './aplicacao/excluir-categoria.js';
import { ListarCategorias } from './aplicacao/listar-categorias.js';
import { UsuariosService } from './aplicacao/usuarios.service.js';
import { CategoriasRepositorio } from './infra/categorias.repositorio.js';

@Module({
  controllers: [UsuariosController, CategoriasController],
  providers: [UsuariosService, ListarCategorias, CriarCategoria, AlterarCategoria, ExcluirCategoria, CategoriasRepositorio],
})
export class AdministracaoModule {}
