import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTOs da API de contratos [Cadastros.RF004]. Datas em "AAAA-MM-DD"; dinheiro em centavos.

const PERIODICIDADES = ['MENSAL', 'ANUAL', 'POR_DEMANDA', 'UNICA'] as const;
const PERIODICIDADE = { enum: PERIODICIDADES, enumName: 'PeriodicidadeContrato' };

export class ContratoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: '26C001', description: 'Gerado pelo sistema: ano + C + sequência' }) codigo!: string;
  @ApiProperty({ description: 'Nome de quem contratamos (texto livre)' }) contraparte!: string;
  @ApiProperty() objeto!: string;
  @ApiProperty({ description: 'Valor previsto por periodicidade' }) valorCentavos!: number;
  @ApiProperty(PERIODICIDADE) periodicidade!: (typeof PERIODICIDADES)[number];
  @ApiProperty({ format: 'date' }) dataInicio!: string;
  @ApiProperty({ type: String, format: 'date', nullable: true, description: 'Nulo = prazo indeterminado' }) dataFim!: string | null;
  @ApiProperty({ enum: ['VIGENTE', 'VENCE_EM_BREVE', 'ENCERRADO'], enumName: 'SituacaoDoContrato' })
  situacao!: 'VIGENTE' | 'VENCE_EM_BREVE' | 'ENCERRADO';
  @ApiProperty({ type: Number, nullable: true, description: 'Dias até o término; negativo se já passou' }) diasParaVencer!: number | null;
  @ApiProperty({ description: 'Saídas pagas no ano corrente' }) pagoNoAnoCentavos!: number;
  @ApiProperty({ type: String, format: 'date', nullable: true }) dataEncerramento!: string | null;
  @ApiProperty({ type: String, nullable: true }) justificativaEncerramento!: string | null;
}

export class ListaDeContratosDto {
  @ApiProperty({ type: [ContratoDto] }) itens!: ContratoDto[];
  @ApiProperty({ description: 'Quantos vencem nos próximos 60 dias' }) quantidadeVencendo!: number;
}

export class CriarContratoDto {
  @ApiProperty() contraparte!: string;
  @ApiProperty() objeto!: string;
  @ApiProperty({ example: 120000 }) valorCentavos!: number;
  @ApiProperty(PERIODICIDADE) periodicidade!: (typeof PERIODICIDADES)[number];
  @ApiProperty({ format: 'date' }) dataInicio!: string;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true }) dataFim?: string | null;
}

// Na alteração todos os campos são opcionais: só muda o que vier. `dataFim: null` deixa sem término.
export class AlterarContratoDto {
  @ApiPropertyOptional() contraparte?: string;
  @ApiPropertyOptional() objeto?: string;
  @ApiPropertyOptional() valorCentavos?: number;
  @ApiPropertyOptional(PERIODICIDADE) periodicidade?: (typeof PERIODICIDADES)[number];
  @ApiPropertyOptional({ format: 'date' }) dataInicio?: string;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true }) dataFim?: string | null;
}

export class EncerrarContratoDto {
  @ApiProperty({ format: 'date' }) dataEncerramento!: string;
  @ApiProperty({ example: 'Serviço passou a ser feito pela AEITA' }) justificativa!: string;
}
