import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { DURACAO_SESSAO_MS, NOME_COOKIE_SESSAO } from '../../../compartilhado/autenticacao/sessao.js';
import { Publico } from '../../../compartilhado/autenticacao/publico.decorator.js';
import { UsuarioAutenticado, type IdentidadeDoUsuario } from '../../../compartilhado/autenticacao/usuario-autenticado.js';
import { Autenticar } from '../aplicacao/autenticar.js';
import { EncerrarSessao } from '../aplicacao/encerrar-sessao.js';
import { LoginDto, UsuarioDaSessaoDto } from './autenticacao.dto.js';

@ApiTags('autenticacao')
@Controller('auth')
export class AutenticacaoController {
  constructor(
    private readonly autenticar: Autenticar,
    private readonly encerrarSessao: EncerrarSessao,
  ) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ operationId: 'entrar', summary: 'Inicia uma sessao' })
  @ApiOkResponse({ type: UsuarioDaSessaoDto })
  @ApiUnauthorizedResponse({ description: 'Credenciais invalidas' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) resposta: Response): Promise<UsuarioDaSessaoDto> {
    const resultado = await this.autenticar.executar(dto?.email, dto?.senha);
    resposta.cookie(NOME_COOKIE_SESSAO, resultado.token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/api',
      maxAge: DURACAO_SESSAO_MS,
    });
    return resultado.usuario;
  }

  @Get('sessao')
  @ApiCookieAuth('cookie')
  @ApiOperation({ operationId: 'buscarSessao', summary: 'Retorna o usuario autenticado' })
  @ApiOkResponse({ type: UsuarioDaSessaoDto })
  sessao(@UsuarioAutenticado() usuario: IdentidadeDoUsuario): UsuarioDaSessaoDto {
    return { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
  }

  @Post('logout')
  @HttpCode(204)
  @ApiCookieAuth('cookie')
  @ApiOperation({ operationId: 'sair', summary: 'Encerra a sessao atual' })
  @ApiNoContentResponse()
  async logout(
    @UsuarioAutenticado() usuario: IdentidadeDoUsuario,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<void> {
    await this.encerrarSessao.executar(usuario.sessaoId);
    resposta.clearCookie(NOME_COOKIE_SESSAO, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/api',
    });
  }
}
