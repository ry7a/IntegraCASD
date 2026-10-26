import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  UsuarioAutenticado,
  type IdentidadeDoUsuario,
} from '../../../compartilhado/autenticacao/usuario-autenticado.js';
import { AlterarProjeto, CriarProjeto, ListarProjetos, type FiltroDeProjetos, type ProjetoComTotais } from '../aplicacao/projetos.js';
import { AlterarProjetoDto, CriarProjetoDto, ListaDeProjetosDto, ProjetoDto } from './projetos.dto.js';

const SITUACOES: FiltroDeProjetos[] = ['em-andamento', 'encerrados', 'todos'];

const ID_DO_PROJETO = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Projeto não encontrado. Atualize a lista e tente de novo.'),
});

function paraDto(projeto: ProjetoComTotais): ProjetoDto {
  return {
    id: projeto.id,
    codigo: projeto.codigo,
    nome: projeto.nome,
    responsavel: projeto.responsavel,
    dataInicio: projeto.dataInicio,
    dataFim: projeto.dataFim,
    orcamentoPrevistoCentavos: projeto.orcamentoPrevistoCentavos,
    situacao: projeto.situacao,
    encerrado: projeto.encerrado,
    saidasCentavos: projeto.saidasCentavos,
    entradasCentavos: projeto.entradasCentavos,
  };
}

// [Cadastros.RF005] Qualquer usuário autenticado mantém projetos.
@ApiTags('projetos')
@ApiCookieAuth('cookie')
@Controller('projetos')
export class ProjetosController {
  constructor(
    private readonly listarProjetos: ListarProjetos,
    private readonly criarProjeto: CriarProjeto,
    private readonly alterarProjeto: AlterarProjeto,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listarProjetos', summary: 'Lista os projetos (por padrão, os em andamento)' })
  @ApiQuery({ name: 'situacao', enum: SITUACOES, required: false })
  @ApiOkResponse({ type: ListaDeProjetosDto })
  async listar(@Query('situacao') situacao?: string): Promise<ListaDeProjetosDto> {
    const filtro = SITUACOES.find((permitida) => permitida === situacao);
    if (situacao !== undefined && filtro === undefined) throw new BadRequestException('Use situacao=em-andamento, encerrados ou todos.');
    return { itens: (await this.listarProjetos.executar(filtro)).map(paraDto) };
  }

  @Post()
  @ApiOperation({ operationId: 'criarProjeto', summary: 'Inclui um projeto' })
  @ApiCreatedResponse({ type: ProjetoDto })
  async criar(@Body() dto: CriarProjetoDto, @UsuarioAutenticado() autor: IdentidadeDoUsuario): Promise<ProjetoDto> {
    return paraDto(await this.criarProjeto.executar(dto ?? {}, autor.id));
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'alterarProjeto', summary: 'Altera ou encerra (executado/cancelado) um projeto' })
  @ApiOkResponse({ type: ProjetoDto })
  async alterar(
    @Param('id', ID_DO_PROJETO) id: string,
    @Body() dto: AlterarProjetoDto,
    @UsuarioAutenticado() autor: IdentidadeDoUsuario,
  ): Promise<ProjetoDto> {
    return paraDto(await this.alterarProjeto.executar(id, dto ?? {}, autor.id));
  }
}
