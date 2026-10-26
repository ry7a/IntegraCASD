import { ApiProperty } from '@nestjs/swagger';

// DTOs dos indicadores [Indicadores.RF001 a RF003]. Dinheiro em centavos.

export class ResumoIndicadoresDto {
  @ApiProperty({ example: '2026-10' }) mes!: string;
  @ApiProperty() entradasCentavos!: number;
  @ApiProperty() saidasCentavos!: number;
  @ApiProperty({ description: 'Entradas menos saídas do mês' }) resultadoCentavos!: number;
  @ApiProperty({ type: Number, nullable: true, description: 'Variação % sobre o mês anterior; nula sem movimento lá' })
  variacaoEntradasPercentual!: number | null;
  @ApiProperty({ type: Number, nullable: true }) variacaoSaidasPercentual!: number | null;
  @ApiProperty({ description: 'Nenhuma movimentação no mês' }) semMovimentacao!: boolean;
  @ApiProperty({ description: 'Pago pelos alunos, ainda não disponível na conta do Asaas' }) aguardandoLiberacaoCentavos!: number;
  @ApiProperty({ description: 'Cobranças vencidas há mais de 7 dias sem sincronizar com o Asaas' }) vencidasSemSincronizar!: number;
}

export class PontoDeEvolucaoDto {
  @ApiProperty({ example: '2026-10' }) mes!: string;
  @ApiProperty() entradasCentavos!: number;
  @ApiProperty() saidasCentavos!: number;
  @ApiProperty() resultadoCentavos!: number;
}

export class EvolucaoDto {
  @ApiProperty({ type: [PontoDeEvolucaoDto], description: 'Do mês mais antigo para o mais recente' }) meses!: PontoDeEvolucaoDto[];
}

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
