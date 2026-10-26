import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import {
  UsuarioAutenticado,
  type IdentidadeDoUsuario,
} from '../../../compartilhado/autenticacao/usuario-autenticado.js';
import { ConsultarCobrancas, type ItemDaLista } from '../aplicacao/consultar-cobrancas.js';
import { CancelarCobranca } from '../aplicacao/cancelar-cobranca.js';
import { DetalharCobranca } from '../aplicacao/detalhar-cobranca.js';
import { EmitirCobrancaAvulsa } from '../aplicacao/emitir-cobranca-avulsa.js';
import { ObterBoleto } from '../aplicacao/obter-boleto.js';
import { ResumirCobrancas } from '../aplicacao/resumir-cobrancas.js';
import { SugerirNovaCobranca } from '../aplicacao/sugerir-nova-cobranca.js';
import { situacaoExibida } from '../dominio/cobranca.js';
import {
  CobrancaDetalheDto,
  CobrancaDto,
  CobrancaListaItemDto,
  BoletoDto,
  CancelarCobrancaDto,
  EmitirCobrancaAvulsaDto,
  ListaDeCobrancasDto,
  ResumoCobrancasDto,
  SugestaoDeNovaCobrancaDto,
} from './cobrancas.dto.js';

const ID_DA_COBRANCA = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Cobrança não encontrada. Volte à lista e escolha outra cobrança.'),
});

// Os mesmos campos do DTO, como objeto simples (o DTO é classe só para o OpenAPI).
type ItemDto = { [Campo in keyof CobrancaListaItemDto]: CobrancaListaItemDto[Campo] };

// Só os campos do contrato (o id do Asaas, por exemplo, só aparece no detalhe).
function paraItemDto(item: ItemDaLista): ItemDto {
  return {
    id: item.id,
    alunoId: item.alunoId,
    alunoNome: item.alunoNome,
    descricao: item.descricao,
    origem: item.origem,
    valorCentavos: item.valorCentavos,
    vencimento: item.vencimento,
    situacao: item.situacao,
    diasDeAtraso: item.diasDeAtraso,
    semSincronizarHaDias: item.semSincronizarHaDias,
  };
}

// Cobranças do aluno. Qualquer usuário autenticado (área administrativa e diretoria).
@ApiTags('cobrancas')
@ApiCookieAuth('cookie')
@Controller('cobrancas')
export class CobrancasController {
  constructor(
    private readonly emitirCobrancaAvulsa: EmitirCobrancaAvulsa,
    private readonly sugerirNovaCobranca: SugerirNovaCobranca,
    private readonly consultarCobrancas: ConsultarCobrancas,
    private readonly resumirCobrancas: ResumirCobrancas,
    private readonly detalharCobranca: DetalharCobranca,
    private readonly obterBoleto: ObterBoleto,
    private readonly cancelarCobranca: CancelarCobranca,
  ) {}

  // [Cobranças.RF008] Os filtros vêm na URL; situações separadas por vírgula (ex.: ABERTA,VENCIDA).
  @Get()
  @ApiOperation({ operationId: 'listarCobrancas', summary: 'Localiza cobranças (padrão: abertas e vencidas)' })
  @ApiQuery({ name: 'situacoes', required: false, description: 'Separadas por vírgula' })
  @ApiQuery({ name: 'busca', required: false, description: 'Nome ou CPF do aluno' })
  @ApiQuery({ name: 'alunoId', required: false })
  @ApiQuery({ name: 'vencimentoDe', required: false })
  @ApiQuery({ name: 'vencimentoAte', required: false })
  @ApiQuery({ name: 'valorMinimoCentavos', required: false, type: Number })
  @ApiQuery({ name: 'valorMaximoCentavos', required: false, type: Number })
  @ApiQuery({ name: 'pagina', required: false, type: Number })
  @ApiQuery({ name: 'tamanhoPagina', required: false, type: Number })
  @ApiOkResponse({ type: ListaDeCobrancasDto })
  async listar(@Query() consulta: Record<string, unknown>): Promise<ListaDeCobrancasDto> {
    const { itens, total } = await this.consultarCobrancas.executar(consulta);
    return { itens: itens.map(paraItemDto), total };
  }

  @Get('resumo')
  @ApiOperation({ operationId: 'resumirCobrancas', summary: 'Estado da conciliação e totais por situação' })
  @ApiOkResponse({ type: ResumoCobrancasDto })
  async resumo(): Promise<ResumoCobrancasDto> {
    const resumo = await this.resumirCobrancas.executar();
    return {
      ...resumo,
      conciliacao: {
        ativa: resumo.conciliacao.ativa,
        ultimaNotificacaoEm: resumo.conciliacao.ultimaNotificacaoEm?.toISOString() ?? null,
        // Preenchida quando a sincronização com o Asaas existir (Cobranças.RF007).
        ultimaSincronizacao: null,
      },
    };
  }

  @Get('sugestao')
  @ApiOperation({ operationId: 'sugerirNovaCobranca', summary: 'Vencimento sugerido, multa e juros vigentes' })
  @ApiOkResponse({ type: SugestaoDeNovaCobrancaDto })
  sugestao(): Promise<SugestaoDeNovaCobrancaDto> {
    return this.sugerirNovaCobranca.executar();
  }

  @Get(':id')
  @ApiOperation({ operationId: 'buscarCobranca', summary: 'Detalhe de uma cobrança, com o histórico' })
  @ApiOkResponse({ type: CobrancaDetalheDto })
  async detalhe(@Param('id', ID_DA_COBRANCA) id: string): Promise<CobrancaDetalheDto> {
    const cobranca = await this.detalharCobranca.executar(id);
    return {
      ...paraItemDto(cobranca),
      asaasId: cobranca.idAsaas,
      multaPercentual: cobranca.multaPercentual,
      jurosMensalPercentual: cobranca.jurosMensalPercentual,
      urlBoleto: cobranca.urlBoleto,
      urlFatura: cobranca.urlFatura,
      pagaEm: cobranca.pagaEm,
      // Preenchidos pelo registro manual (Cobranças.RF006) e pela sincronização (RF007).
      justificativaManual: null,
      canceladaEm: cobranca.canceladaEm?.toISOString() ?? null,
      motivoCancelamento: cobranca.motivoCancelamento,
      renegociacaoDeId: cobranca.renegociacaoDeId,
      renegociadaPorId: cobranca.renegociadaPorId,
      ultimaSincronizacaoEm: null,
      diasDesdeUltimaSincronizacao: null,
      sincronizacaoAntiga: false,
      podeCancelar: cobranca.podeCancelar,
      podeRegistrarPagamentoManual: cobranca.podeRegistrarPagamentoManual,
      eventos: cobranca.eventos.map((evento) => ({ ...evento, ocorridoEm: evento.ocorridoEm.toISOString() })),
    };
  }

  // [Cobranças.RF003] POST porque registra no histórico quem obteve o boleto.
  @Post(':id/boleto')
  @HttpCode(200)
  @ApiOperation({ operationId: 'obterBoleto', summary: 'Link do boleto de uma cobrança aberta' })
  @ApiOkResponse({ type: BoletoDto })
  boleto(@Param('id', ID_DA_COBRANCA) id: string, @UsuarioAutenticado() autor: IdentidadeDoUsuario): Promise<BoletoDto> {
    return this.obterBoleto.executar(id, autor.id);
  }

  // [Cobranças.RF004] Cancela no Asaas e aqui; a renegociação é emitir em seguida uma avulsa com
  // renegociacaoDeId apontando para esta.
  @Post(':id/cancelar')
  @HttpCode(204)
  @ApiOperation({ operationId: 'cancelarCobranca', summary: 'Cancela uma cobrança aberta (no Asaas e aqui)' })
  @ApiNoContentResponse()
  async cancelar(
    @Param('id', ID_DA_COBRANCA) id: string,
    @Body() dto: CancelarCobrancaDto,
    @UsuarioAutenticado() autor: IdentidadeDoUsuario,
  ): Promise<void> {
    await this.cancelarCobranca.executar(id, dto ?? {}, autor.id);
  }

  // [Cobranças.RF002]
  @Post()
  @ApiOperation({ operationId: 'emitirCobrancaAvulsa', summary: 'Emite uma cobrança avulsa no Asaas' })
  @ApiCreatedResponse({ type: CobrancaDto })
  async emitir(@Body() dto: EmitirCobrancaAvulsaDto, @UsuarioAutenticado() autor: IdentidadeDoUsuario): Promise<CobrancaDto> {
    const cobranca = await this.emitirCobrancaAvulsa.executar(dto ?? {}, autor.id);
    return {
      id: cobranca.id,
      alunoId: cobranca.alunoId,
      alunoNome: cobranca.alunoNome,
      origem: cobranca.origem,
      descricao: cobranca.descricao,
      valorCentavos: cobranca.valorCentavos,
      vencimento: cobranca.vencimento,
      situacao: situacaoExibida(cobranca.situacao, cobranca.vencimento, hojeEmSaoPaulo()),
      multaPercentual: cobranca.multaPercentual,
      jurosMensalPercentual: cobranca.jurosMensalPercentual,
      urlBoleto: cobranca.urlBoleto,
      urlFatura: cobranca.urlFatura,
    };
  }
}
