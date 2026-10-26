import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  UsuarioAutenticado,
  type IdentidadeDoUsuario,
} from '../../../compartilhado/autenticacao/usuario-autenticado.js';
import { ListarPendencias, ResolverPendencia } from '../aplicacao/pendencias-de-conciliacao.js';

export class PendenciaDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['SEM_COBRANCA', 'APOS_REGISTRO_MANUAL', 'DIVERGENCIA'], enumName: 'TipoPendencia' })
  tipo!: 'SEM_COBRANCA' | 'APOS_REGISTRO_MANUAL' | 'DIVERGENCIA';
  @ApiProperty({ enum: ['WEBHOOK', 'SINCRONIZACAO'], enumName: 'OrigemPendencia' }) origem!: 'WEBHOOK' | 'SINCRONIZACAO';
  @ApiProperty({ description: 'Id da cobrança no Asaas' }) idAsaas!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'A cobrança daqui, quando existe' })
  cobrancaId!: string | null;
  @ApiProperty({ type: String, nullable: true }) alunoNome!: string | null;
  @ApiProperty() descricao!: string;
  @ApiProperty({ format: 'date-time' }) criadaEm!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) resolvidaEm!: string | null;
  @ApiProperty({ type: String, nullable: true }) resolvidaPor!: string | null;
  @ApiProperty({ type: String, nullable: true }) resolucao!: string | null;
}

export class FalhaDaGeracaoNaFilaDto {
  @ApiProperty({ example: '2026-11' }) referencia!: string;
  @ApiProperty({ description: 'Vazio quando a falha é da rotina inteira (ex.: Asaas fora do ar)' }) alunoId!: string;
  @ApiProperty() alunoNome!: string;
  @ApiProperty() motivo!: string;
  @ApiProperty({ format: 'date-time' }) ocorridaEm!: string;
}

export class FilaDePendenciasDto {
  @ApiProperty({ type: [PendenciaDto] }) itens!: PendenciaDto[];
  @ApiProperty({ type: [FalhaDaGeracaoNaFilaDto], description: 'Só na lista de abertas' }) falhasDaGeracao!: FalhaDaGeracaoNaFilaDto[];
}

export class ResolucaoDto {
  @ApiProperty({ example: 'Pagamento em duplicidade devolvido ao aluno pelo Asaas' }) resolucao!: string;
}

const ID_DA_PENDENCIA = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Pendência não encontrada. Atualize a página.'),
});

// [Cobranças.RF005] fluxo E1: fila de pendências de conciliação (área administrativa e diretoria).
@ApiTags('cobrancas')
@ApiCookieAuth('cookie')
@Controller('cobrancas/conciliacao/pendencias')
export class PendenciasController {
  constructor(
    private readonly listar: ListarPendencias,
    private readonly resolver: ResolverPendencia,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listarPendenciasDeConciliacao', summary: 'Fila de pendências de conciliação' })
  @ApiQuery({ name: 'resolvidas', required: false, type: Boolean, description: 'true: as já resolvidas' })
  @ApiOkResponse({ type: FilaDePendenciasDto })
  async lista(@Query('resolvidas') resolvidas?: string): Promise<FilaDePendenciasDto> {
    const fila = await this.listar.executar(resolvidas === 'true');
    return {
      itens: fila.itens.map((item) => ({
        ...item,
        criadaEm: item.criadaEm.toISOString(),
        resolvidaEm: item.resolvidaEm?.toISOString() ?? null,
      })),
      falhasDaGeracao: fila.falhasDaGeracao.map((falha) => ({ ...falha, ocorridaEm: falha.ocorridaEm.toISOString() })),
    };
  }

  @Post(':id/resolver')
  @HttpCode(204)
  @ApiOperation({ operationId: 'resolverPendenciaDeConciliacao', summary: 'Marca a pendência como resolvida, com o que foi feito' })
  @ApiNoContentResponse()
  async resolverPendencia(
    @Param('id', ID_DA_PENDENCIA) id: string,
    @Body() dto: ResolucaoDto,
    @UsuarioAutenticado() autor: IdentidadeDoUsuario,
  ): Promise<void> {
    await this.resolver.executar(id, dto ?? {}, autor.id);
  }
}
