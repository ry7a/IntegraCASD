import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  UsuarioAutenticado,
  type IdentidadeDoUsuario,
} from '../../../compartilhado/autenticacao/usuario-autenticado.js';
import {
  AlterarContrato,
  CriarContrato,
  EncerrarContrato,
  ListarContratos,
  type ContratoComSituacao,
  type FiltroDeContratos,
} from '../aplicacao/contratos.js';
import { AlterarContratoDto, ContratoDto, CriarContratoDto, EncerrarContratoDto, ListaDeContratosDto } from './contratos.dto.js';

const SITUACOES: FiltroDeContratos[] = ['vigentes', 'encerrados', 'todos'];

const ID_DO_CONTRATO = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Contrato não encontrado. Atualize a lista e tente de novo.'),
});

// Só os campos do contrato da API.
function paraDto(contrato: ContratoComSituacao): ContratoDto {
  return {
    id: contrato.id,
    codigo: contrato.codigo,
    contraparte: contrato.contraparte,
    objeto: contrato.objeto,
    valorCentavos: contrato.valorCentavos,
    periodicidade: contrato.periodicidade,
    dataInicio: contrato.dataInicio,
    dataFim: contrato.dataFim,
    situacao: contrato.situacao,
    diasParaVencer: contrato.diasParaVencer,
    pagoNoAnoCentavos: contrato.pagoNoAnoCentavos,
    dataEncerramento: contrato.dataEncerramento,
    justificativaEncerramento: contrato.justificativaEncerramento,
  };
}

// [Cadastros.RF004] Qualquer usuário autenticado mantém contratos.
@ApiTags('contratos')
@ApiCookieAuth('cookie')
@Controller('contratos')
export class ContratosController {
  constructor(
    private readonly listarContratos: ListarContratos,
    private readonly criarContrato: CriarContrato,
    private readonly alterarContrato: AlterarContrato,
    private readonly encerrarContrato: EncerrarContrato,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listarContratos', summary: 'Lista os contratos (por padrão, os vigentes)' })
  @ApiQuery({ name: 'situacao', enum: SITUACOES, required: false })
  @ApiOkResponse({ type: ListaDeContratosDto })
  async listar(@Query('situacao') situacao?: string): Promise<ListaDeContratosDto> {
    const filtro = SITUACOES.find((permitida) => permitida === situacao);
    if (situacao !== undefined && filtro === undefined) throw new BadRequestException('Use situacao=vigentes, encerrados ou todos.');
    const { itens, quantidadeVencendo } = await this.listarContratos.executar(filtro);
    return { itens: itens.map(paraDto), quantidadeVencendo };
  }

  @Post()
  @ApiOperation({ operationId: 'criarContrato', summary: 'Inclui um contrato' })
  @ApiCreatedResponse({ type: ContratoDto })
  async criar(@Body() dto: CriarContratoDto, @UsuarioAutenticado() autor: IdentidadeDoUsuario): Promise<ContratoDto> {
    return paraDto(await this.criarContrato.executar(dto ?? {}, autor.id));
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'alterarContrato', summary: 'Altera um contrato não encerrado' })
  @ApiOkResponse({ type: ContratoDto })
  async alterar(
    @Param('id', ID_DO_CONTRATO) id: string,
    @Body() dto: AlterarContratoDto,
    @UsuarioAutenticado() autor: IdentidadeDoUsuario,
  ): Promise<ContratoDto> {
    return paraDto(await this.alterarContrato.executar(id, dto ?? {}, autor.id));
  }

  // Fluxo A1: encerramento antecipado.
  @Post(':id/encerrar')
  @HttpCode(200)
  @ApiOperation({ operationId: 'encerrarContrato', summary: 'Encerra o contrato, com data e justificativa' })
  @ApiOkResponse({ type: ContratoDto })
  async encerrar(
    @Param('id', ID_DO_CONTRATO) id: string,
    @Body() dto: EncerrarContratoDto,
    @UsuarioAutenticado() autor: IdentidadeDoUsuario,
  ): Promise<ContratoDto> {
    return paraDto(await this.encerrarContrato.executar(id, dto ?? {}, autor.id));
  }
}
