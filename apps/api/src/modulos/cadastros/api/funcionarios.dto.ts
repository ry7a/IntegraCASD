import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTOs da API de funcionários [Cadastros.RF002]. Datas em "AAAA-MM-DD"; dinheiro em centavos.

export class FuncionarioDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ description: 'Só dígitos, sem pontuação', example: '12345678901' }) cpf!: string;
  @ApiProperty() cargo!: string;
  @ApiProperty({ description: 'Informativo; o pagamento efetivo é uma movimentação de saída' })
  salarioReferenciaCentavos!: number;
  @ApiProperty({ format: 'date', example: '2025-03-01' }) dataAdmissao!: string;
  @ApiProperty({ type: String, format: 'date', nullable: true }) dataDesligamento!: string | null;
  @ApiProperty({ description: 'Calculado pela data de desligamento: inativo a partir dela' }) ativo!: boolean;
}

export class ListaDeFuncionariosDto {
  @ApiProperty({ type: [FuncionarioDto] }) itens!: FuncionarioDto[];
}

export class CriarFuncionarioDto {
  @ApiProperty() nome!: string;
  @ApiProperty({ example: '000.000.000-00', description: 'Com ou sem pontuação' }) cpf!: string;
  @ApiProperty() cargo!: string;
  @ApiProperty({ example: 245000 }) salarioReferenciaCentavos!: number;
  @ApiProperty({ format: 'date', example: '2025-03-01' }) dataAdmissao!: string;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true }) dataDesligamento?: string | null;
}

// Na alteração todos os campos são opcionais: só muda o que vier. `dataDesligamento: null` readmite.
export class AlterarFuncionarioDto {
  @ApiPropertyOptional() nome?: string;
  @ApiPropertyOptional() cpf?: string;
  @ApiPropertyOptional() cargo?: string;
  @ApiPropertyOptional() salarioReferenciaCentavos?: number;
  @ApiPropertyOptional({ format: 'date' }) dataAdmissao?: string;
  @ApiPropertyOptional({ type: String, format: 'date', nullable: true }) dataDesligamento?: string | null;
}
