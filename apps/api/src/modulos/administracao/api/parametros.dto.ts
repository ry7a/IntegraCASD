import { ApiProperty } from '@nestjs/swagger';

// DTOs dos parâmetros de cobrança [Administração.RF003]. Dinheiro em centavos; dias em "AAAA-MM-DD".

export class ParametrosDeCobrancaDto {
  @ApiProperty({ example: 8500 }) valorMensalidadeCentavos!: number;
  @ApiProperty({ minimum: 1, maximum: 28, example: 10 }) diaVencimento!: number;
  @ApiProperty({ minimum: 1, maximum: 28, example: 1, description: 'Precisa ser antes do dia de vencimento' })
  diaGeracao!: number;
  @ApiProperty({ minimum: 0, maximum: 2, description: 'Percentual inteiro (2 = 2%)' }) multaPercentual!: number;
  @ApiProperty({ minimum: 0, maximum: 1, description: 'Percentual inteiro ao mês (1 = 1%)' })
  jurosMensalPercentual!: number;
}

export class ParametrosVigentesDto extends ParametrosDeCobrancaDto {
  @ApiProperty({ format: 'date-time' }) alteradoEm!: string;
  @ApiProperty({ description: 'Nome de quem fez a última alteração' }) alteradoPor!: string;
}

export class ConferenciaDto {
  @ApiProperty({ format: 'date' }) proximaGeracao!: string;
  @ApiProperty({ format: 'date' }) proximoVencimento!: string;
  @ApiProperty({ description: 'Alunos ativos com cadastro completo, que receberão a mensalidade' })
  alunosCobrados!: number;
  @ApiProperty({ description: 'Alunos cobrados x valor da mensalidade' }) totalPrevistoCentavos!: number;
}

export class ConsultaDosParametrosDto {
  @ApiProperty({ type: ParametrosVigentesDto, nullable: true, description: 'Nulo até o primeiro cadastro' })
  vigentes!: ParametrosVigentesDto | null;
  @ApiProperty({ type: ConferenciaDto, nullable: true }) conferencia!: ConferenciaDto | null;
}
