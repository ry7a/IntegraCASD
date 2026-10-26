import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiExtension, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Perfis } from '../../../compartilhado/autenticacao/perfis.decorator.js';
import { UsuarioAutenticado, type IdentidadeDoUsuario } from '../../../compartilhado/autenticacao/usuario-autenticado.js';
import { PerfilUsuario } from '../../../compartilhado/autenticacao/perfil.js';
import { UsuariosService } from '../aplicacao/usuarios.service.js';
import { AlterarUsuarioDto, CriarUsuarioDto, ListaDeUsuariosDto, UsuarioDto } from './usuarios.dto.js';

@ApiTags('administracao')
@ApiCookieAuth('cookie')
@ApiExtension('x-perfil', 'DIRETORIA')
@Perfis(PerfilUsuario.DIRETORIA)
@Controller('admin/usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiOperation({ operationId: 'listarUsuarios', summary: 'Lista usuarios e permissoes' })
  @ApiOkResponse({ type: ListaDeUsuariosDto })
  async listar(): Promise<ListaDeUsuariosDto> {
    return { itens: await this.usuarios.listar() };
  }

  @Post()
  @ApiOperation({ operationId: 'criarUsuario', summary: 'Concede acesso a um usuario' })
  @ApiCreatedResponse({ type: UsuarioDto })
  criar(@Body() dto: CriarUsuarioDto, @UsuarioAutenticado() autor: IdentidadeDoUsuario): Promise<UsuarioDto> {
    return this.usuarios.criar(dto, autor);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'alterarUsuario', summary: 'Altera ou revoga um acesso' })
  @ApiOkResponse({ type: UsuarioDto })
  alterar(
    @Param('id') id: string,
    @Body() dto: AlterarUsuarioDto,
    @UsuarioAutenticado() autor: IdentidadeDoUsuario,
  ): Promise<UsuarioDto> {
    return this.usuarios.alterar(id, dto, autor);
  }
}
