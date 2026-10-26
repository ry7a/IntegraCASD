import { ApiProperty } from '@nestjs/swagger';

// DTOs dos indicadores [Indicadores.RF001 a RF003]. Dinheiro em centavos.

export class GastoPorCategoriaDto {
  @ApiProperty({ format: 'uuid' }) categoriaId!: string;
  @ApiProperty() categoriaNome!: string;
  @ApiProperty() valorCentavos!: number;
  @ApiProperty({ description: 'Parte das saídas do mês, com uma casa decimal (32.0 = 32,0%)' }) percentual!: number;
  @ApiProperty() valorMesAnteriorCentavos!: number;
  @ApiProperty({ type: Number, nullable: true, description: 'Variação % sobre o mês anterior; nulo sem gasto lá' })
  variacaoPercentual!: number | null;
}

export class GastosPorCategoriaDto {
  @ApiProperty({ example: '2026-10' }) mes!: string;
  @ApiProperty() totalSaidasCentavos!: number;
  @ApiProperty() totalMesAnteriorCentavos!: number;
  @ApiProperty({ type: [GastoPorCategoriaDto], description: 'Do maior para o menor gasto do mês' }) itens!: GastoPorCategoriaDto[];
}

export class DevedorDto {
  @ApiProperty({ format: 'uuid' }) alunoId!: string;
  @ApiProperty() alunoNome!: string;
  @ApiProperty({ description: 'Cobranças vencidas' }) quantidade!: number;
  @ApiProperty({ description: 'Soma dos valores originais vencidos, sem multa e juros' }) valorCentavos!: number;
  @ApiProperty() diasDeAtrasoMaisAntigo!: number;
}

export class FaixasDeAtrasoDto {
  @ApiProperty() ate30Dias!: number;
  @ApiProperty() de31a60Dias!: number;
  @ApiProperty() acimaDe60Dias!: number;
}

export class InadimplenciaDto {
  @ApiProperty() alunosInadimplentes!: number;
  @ApiProperty({ description: 'Valores originais, sem multa e juros' }) valorEmAbertoCentavos!: number;
  @ApiProperty({ type: FaixasDeAtrasoDto, description: 'Pelo atraso da cobrança mais antiga de cada aluno' })
  alunosPorFaixa!: FaixasDeAtrasoDto;
  @ApiProperty({ type: [DevedorDto], description: 'Os 10 maiores, por valor' }) maioresDevedores!: DevedorDto[];
}
