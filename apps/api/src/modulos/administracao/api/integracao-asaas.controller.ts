import { Body, Controller, Get, HttpCode, Put } from '@nestjs/common';
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
import { AlterarPrazoDoAlerta, ConsultarIntegracaoAsaas, SubstituirChaveAsaas } from '../aplicacao/integracao-asaas.js';
import {
  AmbienteDaIntegracaoDto,
  IntegracaoAsaasDto,
  PrazoDoAlertaDto,
  SubstituirChaveAsaasDto,
} from './integracao-asaas.dto.js';

// [Administração.RF004] Só a diretoria vê e altera a integração com o Asaas.
@ApiTags('administracao')
@ApiCookieAuth('cookie')
@ApiExtension('x-perfil', 'DIRETORIA')
@Perfis(PerfilUsuario.DIRETORIA)
@Controller('admin/integracao-asaas')
export class IntegracaoAsaasController {
  constructor(
    private readonly consultar: ConsultarIntegracaoAsaas,
    private readonly substituir: SubstituirChaveAsaas,
    private readonly alterarPrazo: AlterarPrazoDoAlerta,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'buscarIntegracaoAsaas', summary: 'Situação da integração (nunca inclui a chave)' })
  @ApiOkResponse({ type: IntegracaoAsaasDto })
  async buscar(): Promise<IntegracaoAsaasDto> {
    const situacao = await this.consultar.executar();
    return {
      ...situacao,
      chaveCadastradaEm: situacao.chaveCadastradaEm?.toISOString() ?? null,
      ultimoTesteEm: situacao.ultimoTesteEm?.toISOString() ?? null,
    };
  }

  @Put('chave')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'substituirChaveAsaas',
    summary: 'Testa a nova chave no Asaas e, se funcionar, guarda cifrada',
  })
  @ApiNoContentResponse()
  async substituirChave(
    @Body() dto: SubstituirChaveAsaasDto,
    @UsuarioAutenticado() autor: IdentidadeDoUsuario,
  ): Promise<void> {
    await this.substituir.executar(dto ?? {}, autor.id);
  }

  @Put('prazo-alerta')
  @HttpCode(204)
  @ApiOperation({ operationId: 'alterarPrazoDoAlertaAsaas', summary: 'Muda o prazo do alerta sem notificações' })
  @ApiNoContentResponse()
  async alterarPrazoDoAlerta(@Body() dto: PrazoDoAlertaDto, @UsuarioAutenticado() autor: IdentidadeDoUsuario): Promise<void> {
    await this.alterarPrazo.executar(dto ?? {}, autor.id);
  }
}

// Qualquer usuário autenticado precisa saber se está no ambiente de testes: a faixa de aviso aparece
// em todas as telas, inclusive para quem não é da diretoria.
@ApiTags('administracao')
@ApiCookieAuth('cookie')
@Controller('integracao')
export class AmbienteDaIntegracaoController {
  constructor(private readonly consultar: ConsultarIntegracaoAsaas) {}

  @Get('ambiente')
  @ApiOperation({ operationId: 'buscarAmbienteDaIntegracao', summary: 'Ambiente do Asaas em uso (testes ou produção)' })
  @ApiOkResponse({ type: AmbienteDaIntegracaoDto })
  async buscar(): Promise<AmbienteDaIntegracaoDto> {
    const { ambiente } = await this.consultar.executar();
    return { ambiente };
  }
}
