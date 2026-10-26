import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTOs da API de projetos [Cadastros.RF005]. Datas em "AAAA-MM-DD"; dinheiro em centavos.

const SITUACOES = ['A_LIBERAR', 'LIBERADO', 'EM_EXECUCAO', 'EXECUTADO', 'CANCELADO'] as const;
const SITUACAO = { enum: SITUACOES, enumName: 'SituacaoProjeto' };

export class ProjetoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: '26P001', description: 'Gerado pelo sistema: ano + P + sequência' }) codigo!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ type: String, nullable: true }) responsavel!: string | null;
  @ApiProperty({ format: 'date' }) dataInicio!: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) dataFim!: string | null;
  @ApiProperty({ type: Number, nullable: true, description: 'Nulo = sem orçamento previsto' }) orcamentoPrevistoCentavos!: number | null;
  @ApiProperty(SITUACAO) situacao!: (typeof SITUACOES)[number];
  @ApiProperty({ description: 'Executado ou cancelado' }) encerrado!: boolean;
  @ApiProperty({ description: 'Saídas vinculadas, sem estornos' }) saidasCentavos!: number;
  @ApiProperty({ description: 'Entradas vinculadas, sem estornos' }) entradasCentavos!: number;
}

export class ListaDeProjetosDto {
  @ApiProperty({ type: [ProjetoDto] }) itens!: ProjetoDto[];
}

export class CriarProjetoDto {
  @ApiProperty() nome!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) responsavel?: string | null;
  @ApiProperty({ format: 'date' }) dataInicio!: string;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true }) dataFim?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) orcamentoPrevistoCentavos?: number | null;
  @ApiPropertyOptional({ ...SITUACAO, description: 'Padrão: A_LIBERAR' }) situacao?: (typeof SITUACOES)[number];
}

// Na alteração todos os campos são opcionais: só muda o que vier.
export class AlterarProjetoDto {
  @ApiPropertyOptional() nome?: string;
  @ApiPropertyOptional({ type: String, nullable: true }) responsavel?: string | null;
  @ApiPropertyOptional({ format: 'date' }) dataInicio?: string;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true }) dataFim?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) orcamentoPrevistoCentavos?: number | null;
  @ApiPropertyOptional(SITUACAO) situacao?: (typeof SITUACOES)[number];
}
