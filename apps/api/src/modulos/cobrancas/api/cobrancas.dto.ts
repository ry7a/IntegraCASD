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
