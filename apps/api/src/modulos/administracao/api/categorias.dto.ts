import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TIPOS_DE_CATEGORIA, type TipoDeCategoria } from '../dominio/categoria.js';

// `enumName` faz o orval gerar um tipo com nome (TipoCategoria) em vez de repetir a lista.
const TIPO = { enum: TIPOS_DE_CATEGORIA, enumName: 'TipoCategoria' };

export class CategoriaComUsoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty(TIPO) tipo!: TipoDeCategoria;
  @ApiProperty() ativo!: boolean;
  @ApiProperty({ description: 'Quantas movimentações usam esta categoria.' })
  quantidadeMovimentacoes!: number;
}

export class ListaDeCategoriasComUsoDto {
  @ApiProperty({ type: [CategoriaComUsoDto], description: 'Ativas primeiro, depois as inativas.' })
  itens!: CategoriaComUsoDto[];
}

export class CriarCategoriaDto {
  @ApiProperty({ minLength: 2, maxLength: 60, example: 'Material de limpeza' }) nome!: string;
  @ApiProperty(TIPO) tipo!: TipoDeCategoria;
}

export class AlterarCategoriaDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 60 }) nome?: string;
  @ApiPropertyOptional(TIPO) tipo?: TipoDeCategoria;
  @ApiPropertyOptional({ description: 'false inativa; true reativa.' }) ativo?: boolean;
}
