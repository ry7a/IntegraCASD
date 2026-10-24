import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListarAlunosAtivos } from '../aplicacao/listar-alunos-ativos.js';
import { ListaDeAlunosDto } from './lista-de-alunos.dto.js';

@ApiTags('alunos')
@ApiCookieAuth('cookie')
@Controller('alunos')
export class AlunosController {
  constructor(private readonly listarAlunosAtivos: ListarAlunosAtivos) {}

  // O operationId vira o nome do hook gerado no frontend: useListarAlunos().
  @Get()
  @ApiOperation({ operationId: 'listarAlunos', summary: 'Lista os alunos ativos' })
  @ApiOkResponse({ type: ListaDeAlunosDto })
  async listar(): Promise<ListaDeAlunosDto> {
    const itens = await this.listarAlunosAtivos.executar();
    return { itens };
  }
}
