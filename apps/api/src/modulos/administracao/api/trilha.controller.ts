import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiExtension, ApiOkResponse, ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ENTIDADES_AUDITADAS, OPERACOES_AUDITADAS } from '../../../compartilhado/auditoria/trilha.js';
import { PerfilUsuario } from '../../../compartilhado/autenticacao/perfil.js';
import { Perfis } from '../../../compartilhado/autenticacao/perfis.decorator.js';
import { ConsultarTrilha } from '../aplicacao/consultar-trilha.js';

export class RegistroAuditoriaDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) ocorridoEm!: string;
  @ApiProperty({ type: String, nullable: true, description: 'Nulo = rotina automática' }) usuarioNome!: string | null;
  @ApiProperty({ enum: OPERACOES_AUDITADAS, enumName: 'OperacaoAuditoria' }) operacao!: (typeof OPERACOES_AUDITADAS)[number];
  @ApiProperty({ enum: ENTIDADES_AUDITADAS, enumName: 'EntidadeAuditoria' }) entidade!: (typeof ENTIDADES_AUDITADAS)[number];
  @ApiProperty({ type: String, nullable: true }) registroId!: string | null;
  @ApiProperty({ description: 'Nunca contém segredos, como a chave do Asaas' }) detalhe!: string;
}

export class ListaDaTrilhaDto {
  @ApiProperty({ type: [RegistroAuditoriaDto], description: 'Do mais recente para o mais antigo' }) itens!: RegistroAuditoriaDto[];
  @ApiProperty({ description: 'Total do filtro, de todas as páginas' }) total!: number;
}

// [Administração.RF005] Só a diretoria consulta a trilha.
@ApiTags('administracao')
@ApiCookieAuth('cookie')
@ApiExtension('x-perfil', 'DIRETORIA')
@Perfis(PerfilUsuario.DIRETORIA)
@Controller('admin/trilha-auditoria')
export class TrilhaController {
  constructor(private readonly consultar: ConsultarTrilha) {}

  @Get()
  @ApiOperation({ operationId: 'listarTrilhaDeAuditoria', summary: 'Operações registradas na trilha (padrão: o mês corrente)' })
  @ApiQuery({ name: 'de', required: false, description: 'AAAA-MM-DD' })
  @ApiQuery({ name: 'ate', required: false, description: 'AAAA-MM-DD' })
  @ApiQuery({ name: 'usuario', required: false, description: 'Id do usuário, ou ROTINA_AUTOMATICA' })
  @ApiQuery({ name: 'operacao', required: false, enum: OPERACOES_AUDITADAS, enumName: 'OperacaoAuditoria' })
  @ApiQuery({ name: 'entidade', required: false, enum: ENTIDADES_AUDITADAS, enumName: 'EntidadeAuditoria' })
  @ApiQuery({ name: 'registroId', required: false, description: 'Um registro específico (fluxo A1)' })
  @ApiQuery({ name: 'pagina', required: false, type: Number })
  @ApiQuery({ name: 'tamanhoPagina', required: false, type: Number })
  @ApiOkResponse({ type: ListaDaTrilhaDto })
  async listar(@Query() consulta: Record<string, unknown>): Promise<ListaDaTrilhaDto> {
    const { itens, total } = await this.consultar.executar(consulta);
    return { itens: itens.map((item) => ({ ...item, ocorridoEm: item.ocorridoEm.toISOString() })), total };
  }
}
