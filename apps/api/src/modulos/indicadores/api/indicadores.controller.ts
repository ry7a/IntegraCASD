import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConsultarInadimplencia } from '../aplicacao/consultar-inadimplencia.js';
import { InadimplenciaDto } from './indicadores.dto.js';

// Painel de indicadores, página inicial. Área administrativa e diretoria.
@ApiTags('indicadores')
@ApiCookieAuth('cookie')
@Controller('indicadores')
export class IndicadoresController {
  constructor(private readonly consultarInadimplencia: ConsultarInadimplencia) {}

  @Get('inadimplencia')
  @ApiOperation({ operationId: 'consultarInadimplencia', summary: 'Alunos com cobranças vencidas, por atraso e maiores devedores' })
  @ApiOkResponse({ type: InadimplenciaDto })
  inadimplencia(): Promise<InadimplenciaDto> {
    return this.consultarInadimplencia.executar();
  }
}
