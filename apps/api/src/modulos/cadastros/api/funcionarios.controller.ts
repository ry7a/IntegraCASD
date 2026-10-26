import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  UsuarioAutenticado,
  type IdentidadeDoUsuario,
} from '../../../compartilhado/autenticacao/usuario-autenticado.js';
import { AlterarFuncionario } from '../aplicacao/alterar-funcionario.js';
import { CriarFuncionario } from '../aplicacao/criar-funcionario.js';
import type { FiltroDeSituacaoDoFuncionario } from '../aplicacao/funcionario-com-situacao.js';
import { ListarFuncionarios } from '../aplicacao/listar-funcionarios.js';
import { AlterarFuncionarioDto, CriarFuncionarioDto, FuncionarioDto, ListaDeFuncionariosDto } from './funcionarios.dto.js';

const SITUACOES: FiltroDeSituacaoDoFuncionario[] = ['ativos', 'inativos', 'todos'];

const ID_DO_FUNCIONARIO = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Funcionário não encontrado. Atualize a lista e tente de novo.'),
});

// [Cadastros.RF002] Qualquer usuário autenticado mantém funcionários.
@ApiTags('funcionarios')
@ApiCookieAuth('cookie')
@Controller('funcionarios')
export class FuncionariosController {
  constructor(
    private readonly listarFuncionarios: ListarFuncionarios,
    private readonly criarFuncionario: CriarFuncionario,
    private readonly alterarFuncionario: AlterarFuncionario,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listarFuncionarios', summary: 'Lista os funcionários (por padrão, só os ativos)' })
  @ApiQuery({ name: 'situacao', enum: SITUACOES, required: false })
  @ApiOkResponse({ type: ListaDeFuncionariosDto })
  async listar(@Query('situacao') situacao?: string): Promise<ListaDeFuncionariosDto> {
    const filtro = SITUACOES.find((permitida) => permitida === situacao);
    if (situacao !== undefined && filtro === undefined) {
      throw new BadRequestException('Use situacao=ativos, inativos ou todos.');
    }
    return { itens: await this.listarFuncionarios.executar(filtro) };
  }

  @Post()
  @ApiOperation({ operationId: 'criarFuncionario', summary: 'Inclui um funcionário' })
  @ApiCreatedResponse({ type: FuncionarioDto })
  criar(@Body() dto: CriarFuncionarioDto, @UsuarioAutenticado() autor: IdentidadeDoUsuario): Promise<FuncionarioDto> {
    return this.criarFuncionario.executar(dto ?? {}, autor.id);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'alterarFuncionario', summary: 'Altera, desliga ou readmite um funcionário' })
  @ApiOkResponse({ type: FuncionarioDto })
  alterar(
    @Param('id', ID_DO_FUNCIONARIO) id: string,
    @Body() dto: AlterarFuncionarioDto,
    @UsuarioAutenticado() autor: IdentidadeDoUsuario,
  ): Promise<FuncionarioDto> {
    return this.alterarFuncionario.executar(id, dto ?? {}, autor.id);
  }
}
