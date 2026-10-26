import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiExtension,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PerfilUsuario } from '../../../compartilhado/autenticacao/perfil.js';
import { Perfis } from '../../../compartilhado/autenticacao/perfis.decorator.js';
import {
  UsuarioAutenticado,
  type IdentidadeDoUsuario,
} from '../../../compartilhado/autenticacao/usuario-autenticado.js';
import { AlterarCategoria } from '../aplicacao/alterar-categoria.js';
import { CriarCategoria } from '../aplicacao/criar-categoria.js';
import { ExcluirCategoria } from '../aplicacao/excluir-categoria.js';
import { ListarCategorias } from '../aplicacao/listar-categorias.js';
import {
  AlterarCategoriaDto,
  CategoriaComUsoDto,
  CriarCategoriaDto,
  ListaDeCategoriasComUsoDto,
} from './categorias.dto.js';

// Id da URL precisa ser um uuid; se não for, responde 400 com mensagem em português.
const ID_DA_CATEGORIA = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Categoria não encontrada. Atualize a lista e tente de novo.'),
});

// [Administração.RF002] Só a diretoria mantém categorias.
@ApiTags('administracao')
@ApiCookieAuth('cookie')
@ApiExtension('x-perfil', 'DIRETORIA')
@Perfis(PerfilUsuario.DIRETORIA)
@Controller('admin/categorias')
export class CategoriasController {
  constructor(
    private readonly listarCategorias: ListarCategorias,
    private readonly criarCategoria: CriarCategoria,
    private readonly alterarCategoria: AlterarCategoria,
    private readonly excluirCategoria: ExcluirCategoria,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listarCategoriasComUso', summary: 'Lista as categorias com o uso de cada uma' })
  @ApiOkResponse({ type: ListaDeCategoriasComUsoDto })
  async listar(): Promise<ListaDeCategoriasComUsoDto> {
    return { itens: await this.listarCategorias.executar() };
  }

  @Post()
  @ApiOperation({ operationId: 'criarCategoria', summary: 'Inclui uma categoria de movimentação' })
  @ApiCreatedResponse({ type: CategoriaComUsoDto })
  criar(@Body() dto: CriarCategoriaDto, @UsuarioAutenticado() autor: IdentidadeDoUsuario): Promise<CategoriaComUsoDto> {
    return this.criarCategoria.executar(dto ?? {}, autor.id);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'alterarCategoria', summary: 'Altera, inativa ou reativa uma categoria' })
  @ApiOkResponse({ type: CategoriaComUsoDto })
  alterar(
    @Param('id', ID_DA_CATEGORIA) id: string,
    @Body() dto: AlterarCategoriaDto,
    @UsuarioAutenticado() autor: IdentidadeDoUsuario,
  ): Promise<CategoriaComUsoDto> {
    return this.alterarCategoria.executar(id, dto ?? {}, autor.id);
  }

  // Só categoria nunca usada; com movimentações responde 409 e orienta a inativar.
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'excluirCategoria', summary: 'Exclui uma categoria que nunca foi usada' })
  @ApiNoContentResponse()
  excluir(@Param('id', ID_DA_CATEGORIA) id: string, @UsuarioAutenticado() autor: IdentidadeDoUsuario): Promise<void> {
    return this.excluirCategoria.executar(id, autor.id);
  }
}
