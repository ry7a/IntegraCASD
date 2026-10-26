import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { hojeEmSaoPaulo } from '../../../compartilhado/datas.js';
import {
  UsuarioAutenticado,
  type IdentidadeDoUsuario,
} from '../../../compartilhado/autenticacao/usuario-autenticado.js';
import { EmitirCobrancaAvulsa } from '../aplicacao/emitir-cobranca-avulsa.js';
import { SugerirNovaCobranca } from '../aplicacao/sugerir-nova-cobranca.js';
import { situacaoExibida } from '../dominio/cobranca.js';
import { CobrancaDto, EmitirCobrancaAvulsaDto, SugestaoDeNovaCobrancaDto } from './cobrancas.dto.js';

// Cobranças do aluno. Qualquer usuário autenticado (área administrativa e diretoria).
@ApiTags('cobrancas')
@ApiCookieAuth('cookie')
@Controller('cobrancas')
export class CobrancasController {
  constructor(
    private readonly emitirCobrancaAvulsa: EmitirCobrancaAvulsa,
    private readonly sugerirNovaCobranca: SugerirNovaCobranca,
  ) {}

  @Get('sugestao')
  @ApiOperation({ operationId: 'sugerirNovaCobranca', summary: 'Vencimento sugerido, multa e juros vigentes' })
  @ApiOkResponse({ type: SugestaoDeNovaCobrancaDto })
  sugestao(): Promise<SugestaoDeNovaCobrancaDto> {
    return this.sugerirNovaCobranca.executar();
  }

  // [Cobranças.RF002]
  @Post()
  @ApiOperation({ operationId: 'emitirCobrancaAvulsa', summary: 'Emite uma cobrança avulsa no Asaas' })
  @ApiCreatedResponse({ type: CobrancaDto })
  async emitir(@Body() dto: EmitirCobrancaAvulsaDto, @UsuarioAutenticado() autor: IdentidadeDoUsuario): Promise<CobrancaDto> {
    const cobranca = await this.emitirCobrancaAvulsa.executar(dto ?? {}, autor.id);
    // Só os campos do contrato (o id do Asaas, por exemplo, não vai para a tela).
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
