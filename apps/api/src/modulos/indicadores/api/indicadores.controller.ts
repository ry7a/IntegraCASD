import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ConsultarGastosPorCategoria } from '../aplicacao/consultar-gastos-por-categoria.js';
import { ConsultarInadimplencia } from '../aplicacao/consultar-inadimplencia.js';
import { GastosPorCategoriaDto, InadimplenciaDto } from './indicadores.dto.js';

// Painel de indicadores, página inicial. Área administrativa e diretoria.
@ApiTags('indicadores')
@ApiCookieAuth('cookie')
@Controller('indicadores')
export class IndicadoresController {
  constructor(
    private readonly consultarInadimplencia: ConsultarInadimplencia,
    private readonly consultarGastos: ConsultarGastosPorCategoria,
  ) {}

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
