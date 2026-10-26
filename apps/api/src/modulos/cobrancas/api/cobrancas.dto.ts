import { ApiProperty } from '@nestjs/swagger';

// DTOs da API de cobranças. Dinheiro em centavos; dias em "AAAA-MM-DD".

const SITUACOES = ['ABERTA', 'VENCIDA', 'PAGA', 'PAGA_COM_REGISTRO_MANUAL', 'CANCELADA', 'ESTORNADA'] as const;
const ORIGENS = ['MENSALIDADE', 'AVULSA'] as const;

export class CobrancaDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) alunoId!: string;
  @ApiProperty() alunoNome!: string;
  @ApiProperty({ enum: ORIGENS, enumName: 'OrigemCobranca' }) origem!: (typeof ORIGENS)[number];
  @ApiProperty() descricao!: string;
  @ApiProperty({ description: 'Valor original, sem multa e juros' }) valorCentavos!: number;
  @ApiProperty({ format: 'date' }) vencimento!: string;
  @ApiProperty({ enum: SITUACOES, enumName: 'SituacaoCobranca', description: 'VENCIDA = aberta com vencimento passado' })
  situacao!: (typeof SITUACOES)[number];
  @ApiProperty({ description: 'Percentual inteiro enviado ao Asaas na emissão' }) multaPercentual!: number;
  @ApiProperty({ description: 'Percentual inteiro ao mês enviado ao Asaas na emissão' }) jurosMensalPercentual!: number;
  @ApiProperty({ type: String, nullable: true }) urlBoleto!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Página da fatura no Asaas (boleto e Pix)' })
  urlFatura!: string | null;
}

export class EmitirCobrancaAvulsaDto {
  @ApiProperty({ format: 'uuid' }) alunoId!: string;
  @ApiProperty({ example: 4500 }) valorCentavos!: number;
  @ApiProperty({ format: 'date', example: '2026-11-10' }) vencimento!: string;
  @ApiProperty({ example: 'Camiseta do CASD' }) descricao!: string;
}

export class SugestaoDeNovaCobrancaDto {
  @ApiProperty({ description: 'Falso enquanto a diretoria não cadastrar os parâmetros de cobrança' })
  parametrosCadastrados!: boolean;
  @ApiProperty({ type: String, format: 'date', nullable: true }) vencimentoSugerido!: string | null;
  @ApiProperty({ type: Number, nullable: true }) multaPercentual!: number | null;
  @ApiProperty({ type: Number, nullable: true }) jurosMensalPercentual!: number | null;
}

// ---------------------------------------------------------------------------
// Consulta [Cobranças.RF008]
// ---------------------------------------------------------------------------

export class CobrancaListaItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) alunoId!: string;
  @ApiProperty() alunoNome!: string;
  @ApiProperty() descricao!: string;
  @ApiProperty({ enum: ORIGENS, enumName: 'OrigemCobranca' }) origem!: (typeof ORIGENS)[number];
  @ApiProperty({ description: 'Valor original, sem multa e juros' }) valorCentavos!: number;
  @ApiProperty({ format: 'date' }) vencimento!: string;
  @ApiProperty({ enum: SITUACOES, enumName: 'SituacaoCobranca' }) situacao!: (typeof SITUACOES)[number];
  @ApiProperty({ type: Number, nullable: true, description: 'Só para cobrança vencida' }) diasDeAtraso!: number | null;
  @ApiProperty({ type: Number, nullable: true, description: 'Vencida há muito tempo sem sincronizar com o Asaas' })
  semSincronizarHaDias!: number | null;
}

export class ListaDeCobrancasDto {
  @ApiProperty({ type: [CobrancaListaItemDto] }) itens!: CobrancaListaItemDto[];
  @ApiProperty({ description: 'Total de cobranças com esses filtros (todas as páginas)' }) total!: number;
}

export class ResumoSituacaoDto {
  @ApiProperty({ enum: SITUACOES, enumName: 'SituacaoCobranca' }) situacao!: (typeof SITUACOES)[number];
  @ApiProperty() quantidade!: number;
  @ApiProperty({ description: 'Soma dos valores originais' }) valorCentavos!: number;
}

export class SincronizacaoDto {
  @ApiProperty({ format: 'date-time' }) iniciadaEm!: string;
  @ApiProperty() conferidas!: number;
  @ApiProperty() atualizadas!: number;
  @ApiProperty() somenteNoAsaas!: number;
  @ApiProperty() paraConferir!: number;
}

export class ConciliacaoDto {
  @ApiProperty({ description: 'A integração com o Asaas está configurada' }) ativa!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) ultimaNotificacaoEm!: string | null;
  @ApiProperty({ type: SincronizacaoDto, nullable: true }) ultimaSincronizacao!: SincronizacaoDto | null;
}

export class ResumoCobrancasDto {
  @ApiProperty({ example: '2026-10', description: 'Mês dos totais de pagas, canceladas e estornadas' }) mes!: string;
  @ApiProperty({
    type: [ResumoSituacaoDto],
    description: 'Abertas e vencidas: todas. Demais: só as que mudaram de situação no mês',
  })
  situacoes!: ResumoSituacaoDto[];
  @ApiProperty({ type: ConciliacaoDto }) conciliacao!: ConciliacaoDto;
}

export class EventoCobrancaDto {
  @ApiProperty() id!: string;
  @ApiProperty({ format: 'date-time' }) ocorridoEm!: string;
  @ApiProperty() descricao!: string;
  @ApiProperty({ enum: ['ASAAS', 'USUARIO'] }) origem!: 'ASAAS' | 'USUARIO';
}

export class CobrancaDetalheDto extends CobrancaListaItemDto {
  @ApiProperty({ type: String, nullable: true, description: 'Identificação da cobrança no Asaas' }) asaasId!: string | null;
  @ApiProperty() multaPercentual!: number;
  @ApiProperty() jurosMensalPercentual!: number;
  @ApiProperty({ type: String, nullable: true }) urlBoleto!: string | null;
  @ApiProperty({ type: String, nullable: true }) urlFatura!: string | null;
  @ApiProperty({ type: String, format: 'date', nullable: true }) pagaEm!: string | null;
  @ApiProperty({ type: String, nullable: true }) justificativaManual!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) ultimaSincronizacaoEm!: string | null;
  @ApiProperty({ type: Number, nullable: true }) diasDesdeUltimaSincronizacao!: number | null;
  @ApiProperty() sincronizacaoAntiga!: boolean;
  @ApiProperty({ description: 'Só cobrança aberta ou vencida pode ser cancelada' }) podeCancelar!: boolean;
  @ApiProperty({ description: 'Só cobrança aberta ou vencida aceita pagamento manual' }) podeRegistrarPagamentoManual!: boolean;
  @ApiProperty({ type: [EventoCobrancaDto], description: 'Do mais recente para o mais antigo' }) eventos!: EventoCobrancaDto[];
}
