import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import {
  ApiCookieAuth,
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
import { AlterarParametrosDeCobranca } from '../aplicacao/alterar-parametros-de-cobranca.js';
import { ConferirParametrosDeCobranca } from '../aplicacao/conferir-parametros-de-cobranca.js';
import { ConsultarParametrosDeCobranca } from '../aplicacao/consultar-parametros-de-cobranca.js';
import { ListarOpcoesDeDestino } from '../aplicacao/listar-opcoes-de-destino.js';
import { ConferenciaDto, ConsultaDosParametrosDto, OpcoesDeDestinoDto, ParametrosDeCobrancaDto } from './parametros.dto.js';

// [Administração.RF003] Só a diretoria define os parâmetros das cobranças recorrentes.
@ApiTags('administracao')
@ApiCookieAuth('cookie')
@ApiExtension('x-perfil', 'DIRETORIA')
@Perfis(PerfilUsuario.DIRETORIA)
@Controller('admin/parametros-cobranca')
export class ParametrosController {
  constructor(
    private readonly consultar: ConsultarParametrosDeCobranca,
    private readonly conferirParametros: ConferirParametrosDeCobranca,
    private readonly alterar: AlterarParametrosDeCobranca,
    private readonly listarOpcoes: ListarOpcoesDeDestino,
  ) {}

  @Get('destinos')
  @ApiOperation({
    operationId: 'listarDestinosDaConciliacao',
    summary: 'Contas e categorias que podem receber os pagamentos conciliados',
  })
  @ApiOkResponse({ type: OpcoesDeDestinoDto })
  destinos(): Promise<OpcoesDeDestinoDto> {
    return this.listarOpcoes.executar();
  }

  @Get()
  @ApiOperation({
    operationId: 'buscarParametrosDeCobranca',
    summary: 'Parâmetros vigentes e conferência da próxima geração',
  })
  @ApiOkResponse({ type: ConsultaDosParametrosDto })
  async buscar(): Promise<ConsultaDosParametrosDto> {
    const { vigentes, conferencia } = await this.consultar.executar();
    return {
      vigentes: vigentes === null ? null : { ...vigentes, alteradoEm: vigentes.alteradoEm.toISOString() },
      conferencia,
    };
  }

  // POST porque recebe um corpo; não grava nada (fluxo principal, passo 4).
  @Post('conferencia')
  @HttpCode(200)
  @ApiOperation({ operationId: 'conferirParametrosDeCobranca', summary: 'Mostra o efeito dos valores antes de salvar' })
  @ApiOkResponse({ type: ConferenciaDto })
  conferir(@Body() dto: ParametrosDeCobrancaDto): Promise<ConferenciaDto> {
    return this.conferirParametros.executar(dto ?? {});
  }

  @Put()
  @HttpCode(204)
  @ApiOperation({
    operationId: 'alterarParametrosDeCobranca',
    summary: 'Grava novos parâmetros (valem para as próximas cobranças)',
  })
  @ApiNoContentResponse()
  async gravar(@Body() dto: ParametrosDeCobrancaDto, @UsuarioAutenticado() autor: IdentidadeDoUsuario): Promise<void> {
    await this.alterar.executar(dto ?? {}, autor.id);
  }
}
