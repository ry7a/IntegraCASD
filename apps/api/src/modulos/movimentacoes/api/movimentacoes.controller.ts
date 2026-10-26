import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ConsultarMovimentacoes } from '../aplicacao/consultar-movimentacoes.js';
import { ListarOpcoesDaMovimentacao } from '../aplicacao/listar-opcoes.js';
import { ListaDeMovimentacoesDto, OpcoesDaMovimentacaoDto } from './movimentacoes.dto.js';

// Entradas e saídas do CASD. Qualquer usuário autenticado (área administrativa e diretoria).
@ApiTags('movimentacoes')
@ApiCookieAuth('cookie')
@Controller('movimentacoes')
export class MovimentacoesController {
  constructor(
    private readonly consultar: ConsultarMovimentacoes,
    private readonly listarOpcoes: ListarOpcoesDaMovimentacao,
  ) {}

  // [Movimentações.RF003] Filtros na URL. Sem mês, o corrente.
  @Get()
  @ApiOperation({ operationId: 'listarMovimentacoes', summary: 'Movimentações do mês, com os totais do recorte' })
  @ApiQuery({ name: 'mes', required: false, description: 'AAAA-MM; padrão: o mês corrente' })
  @ApiQuery({ name: 'tipo', required: false, enum: ['ENTRADA', 'SAIDA'] })
  @ApiQuery({ name: 'categoriaId', required: false })
  @ApiQuery({ name: 'forma', required: false, enum: ['ASAAS', 'PIX', 'TRANSFERENCIA', 'DINHEIRO', 'CARTAO'] })
  @ApiQuery({ name: 'contratoId', required: false })
  @ApiQuery({ name: 'projetoId', required: false })
  @ApiQuery({ name: 'ocultarEstornos', required: false, type: Boolean })
  @ApiOkResponse({ type: ListaDeMovimentacoesDto })
  async listar(@Query() consulta: Record<string, unknown>): Promise<ListaDeMovimentacoesDto> {
    const { itens, totais } = await this.consultar.executar(consulta);
    return {
      itens: itens.map((item) => ({
        id: item.id,
        data: item.data,
        descricao: item.descricao,
        tipo: item.tipo,
        valorCentavos: item.valorCentavos,
        categoriaNome: item.categoriaNome,
        forma: item.forma,
        origem: item.origem,
        contaNome: item.contaNome,
        registradaPor: item.registradaPor,
        vinculo: item.vinculo,
        estornadaEm: item.estornadaEm,
        motivoEstorno: item.motivoEstorno,
        podeEstornar: item.podeEstornar,
        motivoSemEstorno: item.motivoSemEstorno,
      })),
      total: itens.length,
      totais,
    };
  }

  @Get('opcoes')
  @ApiOperation({ operationId: 'listarOpcoesDaMovimentacao', summary: 'Contas, categorias e vínculos possíveis' })
  @ApiOkResponse({ type: OpcoesDaMovimentacaoDto })
  opcoes(): Promise<OpcoesDaMovimentacaoDto> {
    return this.listarOpcoes.executar();
  }
}
