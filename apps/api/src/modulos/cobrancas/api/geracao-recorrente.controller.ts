import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ListarExecucoesDaGeracao } from '../aplicacao/listar-execucoes-da-geracao.js';
import { PedirGeracaoAgora } from '../aplicacao/pedir-geracao-agora.js';

export class FalhaDaGeracaoDto {
  @ApiProperty({ description: 'Vazio quando a falha é da rotina inteira (ex.: Asaas fora do ar)' }) alunoId!: string;
  @ApiProperty() alunoNome!: string;
  @ApiProperty() motivo!: string;
}

export class ExecucaoGeracaoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: '2026-11', description: 'Mês das mensalidades' }) referencia!: string;
  @ApiProperty({ enum: ['AGENDADA', 'MANUAL'] }) origem!: 'AGENDADA' | 'MANUAL';
  @ApiProperty({ format: 'date-time' }) iniciadaEm!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) finalizadaEm!: string | null;
  @ApiProperty({ description: 'Cobranças criadas' }) totalProcessado!: number;
  @ApiProperty({ description: 'Alunos que já tinham a mensalidade do mês' }) totalJaExistentes!: number;
  @ApiProperty() totalFalhas!: number;
  @ApiProperty({ type: [FalhaDaGeracaoDto] }) falhas!: FalhaDaGeracaoDto[];
  @ApiProperty({ description: 'O Asaas parou no meio; nova tentativa agendada' }) interrompida!: boolean;
}

export class ListaDeExecucoesDto {
  @ApiProperty({ type: [ExecucaoGeracaoDto], description: 'Da mais recente para a mais antiga' })
  itens!: ExecucaoGeracaoDto[];
}

export class PedidoDeGeracaoDto {
  @ApiProperty({ example: '2026-11' }) referencia!: string;
}

// [Cobranças.RF001] Acompanhamento e novo pedido da geração recorrente (área administrativa e diretoria).
@ApiTags('cobrancas')
@ApiCookieAuth('cookie')
@Controller('cobrancas/geracao-recorrente')
export class GeracaoRecorrenteController {
  constructor(
    private readonly listarExecucoes: ListarExecucoesDaGeracao,
    private readonly pedirGeracaoAgora: PedirGeracaoAgora,
  ) {}

  @Get('execucoes')
  @ApiOperation({ operationId: 'listarExecucoesDaGeracao', summary: 'Últimas execuções da geração recorrente' })
  @ApiOkResponse({ type: ListaDeExecucoesDto })
  async execucoes(): Promise<ListaDeExecucoesDto> {
    const execucoes = await this.listarExecucoes.executar();
    return {
      itens: execucoes.map((execucao) => ({
        id: execucao.id,
        referencia: execucao.referencia,
        origem: execucao.origem,
        iniciadaEm: execucao.iniciadaEm.toISOString(),
        finalizadaEm: execucao.finalizadaEm?.toISOString() ?? null,
        totalProcessado: execucao.totalCriadas,
        totalJaExistentes: execucao.totalJaExistentes,
        totalFalhas: execucao.totalFalhas,
        falhas: execucao.falhas,
        interrompida: execucao.interrompida,
      })),
    };
  }

  // Fluxo A2: gera os pendentes do mês (quem já tem a mensalidade é pulado). Roda no worker.
  @Post()
  @HttpCode(202)
  @ApiOperation({ operationId: 'pedirGeracaoAgora', summary: 'Gera agora as mensalidades pendentes do mês' })
  @ApiAcceptedResponse({ type: PedidoDeGeracaoDto })
  pedir(): Promise<PedidoDeGeracaoDto> {
    return this.pedirGeracaoAgora.executar();
  }
}
