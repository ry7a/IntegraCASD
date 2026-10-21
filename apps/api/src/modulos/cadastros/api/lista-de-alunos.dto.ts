import { ApiProperty } from '@nestjs/swagger';
import { SituacaoAluno } from '../../../generated/prisma/enums.js';

// DTOs de resposta. Os decorators @ApiProperty descrevem cada campo no OpenAPI,
// e é desse OpenAPI que o orval gera os tipos e hooks do frontend.

export class AlunoResumoDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nome: string;

  @ApiProperty({ description: 'Só dígitos, sem pontuação', example: '12345678901' })
  cpf: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ type: String, nullable: true, example: 'T28' })
  turma: string | null;

  @ApiProperty({ enum: SituacaoAluno, enumName: 'SituacaoAluno', nullable: true })
  situacao: SituacaoAluno | null;
}

// A lista vem dentro de um objeto (e não como array solto) para podermos
// acrescentar paginação (total, página) depois sem quebrar o contrato.
export class ListaDeAlunosDto {
  @ApiProperty({ type: [AlunoResumoDto] })
  itens: AlunoResumoDto[];
}
