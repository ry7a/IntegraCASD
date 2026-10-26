import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ConsultarGastosPorCategoria } from '../aplicacao/consultar-gastos-por-categoria.js';
import { ConsultarInadimplencia } from '../aplicacao/consultar-inadimplencia.js';
import { ConsultarEvolucao, ConsultarResumoDoPainel } from '../aplicacao/consultar-painel.js';
import { EvolucaoDto, GastosPorCategoriaDto, InadimplenciaDto, ResumoIndicadoresDto } from './indicadores.dto.js';

// Painel de indicadores, página inicial. Área administrativa e diretoria.
@ApiTags('indicadores')
@ApiCookieAuth('cookie')
@Controller('indicadores')
export class IndicadoresController {
  constructor(
    private readonly consultarInadimplencia: ConsultarInadimplencia,
    private readonly consultarGastos: ConsultarGastosPorCategoria,
    private readonly consultarResumo: ConsultarResumoDoPainel,
    private readonly consultarEvolucao: ConsultarEvolucao,
  ) {}

  @Get('resumo')
  @ApiOperation({ operationId: 'consultarResumoDosIndicadores', summary: 'Entradas, saídas e resultado do mês, comparados ao anterior' })
  @ApiQuery({ name: 'mes', required: false, description: 'AAAA-MM; padrão: o mês corrente' })
  @ApiOkResponse({ type: ResumoIndicadoresDto })
  resumo(@Query('mes') mes?: string): Promise<ResumoIndicadoresDto> {
    return this.consultarResumo.executar(mes);
  }

  @Get('evolucao')
  @ApiOperation({ operationId: 'consultarEvolucao', summary: 'Entradas e saídas dos 6 meses até o mês de referência' })
  @ApiQuery({ name: 'ate', required: false, description: 'AAAA-MM; padrão: o mês corrente' })
  @ApiOkResponse({ type: EvolucaoDto })
  async evolucao(@Query('ate') ate?: string): Promise<EvolucaoDto> {
    return { meses: await this.consultarEvolucao.executar(ate) };
  }

  @Get('gastos-por-categoria')
  @ApiOperation({ operationId: 'consultarGastosPorCategoria', summary: 'Saídas do mês por categoria, com o mês anterior' })
  @ApiQuery({ name: 'mes', required: false, description: 'AAAA-MM; padrão: o mês corrente' })
  @ApiOkResponse({ type: GastosPorCategoriaDto })
  gastosPorCategoria(@Query('mes') mes?: string): Promise<GastosPorCategoriaDto> {
    return this.consultarGastos.executar(mes);
  }

  @Get('inadimplencia')
  @ApiOperation({ operationId: 'consultarInadimplencia', summary: 'Alunos com cobranças vencidas, por atraso e maiores devedores' })
  @ApiOkResponse({ type: InadimplenciaDto })
  inadimplencia(): Promise<InadimplenciaDto> {
    return this.consultarInadimplencia.executar();
  }
}
