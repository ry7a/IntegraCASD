import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CURSOS, POSTOS, type Curso, type Posto } from '../dominio/aluno.js';

// DTOs da API de alunos. Os decorators @ApiProperty descrevem cada campo no OpenAPI,
// e é desse OpenAPI que o orval gera os tipos e hooks do frontend.
// `enumName` faz o orval gerar um tipo com nome (CursoAluno, PostoAluno) em vez de repetir a lista.

export class AlojamentoDto {
  @ApiProperty({ example: 'A' }) bloco!: string;
  @ApiProperty({ example: '101' }) apto!: string;
  @ApiProperty({ example: '1' }) vaga!: string;
}

export class AlunoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ description: 'Só dígitos, sem pontuação', example: '12345678901' }) cpf!: string;
  @ApiProperty({ description: 'Vazio quando o cadastro está incompleto' }) email!: string;
  @ApiProperty({ type: String, nullable: true, description: 'Só dígitos, com DDD' }) celular!: string | null;
  @ApiProperty({ type: String, nullable: true }) apelido!: string | null;
  @ApiProperty({ type: Number, nullable: true }) matricula!: number | null;
  @ApiProperty({ type: String, nullable: true, example: 'T28' }) turma!: string | null;
  @ApiProperty({ enum: CURSOS, enumName: 'CursoAluno', nullable: true }) curso!: Curso | null;
  @ApiProperty({ enum: POSTOS, enumName: 'PostoAluno', nullable: true }) posto!: Posto | null;
  @ApiProperty({ type: AlojamentoDto, nullable: true }) alojamento!: AlojamentoDto | null;
  @ApiProperty({ description: 'Situação do cadastro: só alunos ativos recebem a mensalidade automática' })
  ativo!: boolean;
  @ApiProperty({ description: 'Sem e-mail ou com CPF inválido: não recebe cobrança até ser corrigido' })
  cadastroIncompleto!: boolean;
}

// A lista vem dentro de um objeto (e não como array solto) para podermos
// acrescentar paginação (total, página) depois sem quebrar o contrato.
export class ListaDeAlunosDto {
  @ApiProperty({ type: [AlunoDto] }) itens!: AlunoDto[];
}

export class CriarAlunoDto {
  @ApiProperty() nome!: string;
  @ApiProperty({ example: '000.000.000-00', description: 'Com ou sem pontuação' }) cpf!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) celular?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) apelido?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) matricula?: number | null;
  @ApiPropertyOptional({ type: String, nullable: true, example: 'T28' }) turma?: string | null;
  @ApiPropertyOptional({ enum: CURSOS, enumName: 'CursoAluno', nullable: true }) curso?: Curso | null;
  @ApiPropertyOptional({ enum: POSTOS, enumName: 'PostoAluno', nullable: true }) posto?: Posto | null;
  @ApiPropertyOptional({ type: AlojamentoDto, nullable: true }) alojamento?: AlojamentoDto | null;
}

// Na alteração todos os campos são opcionais: só muda o que vier. `null` limpa um campo opcional.
export class AlterarAlunoDto {
  @ApiPropertyOptional() nome?: string;
  @ApiPropertyOptional() cpf?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional({ type: String, nullable: true }) celular?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) apelido?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) matricula?: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) turma?: string | null;
  @ApiPropertyOptional({ enum: CURSOS, enumName: 'CursoAluno', nullable: true }) curso?: Curso | null;
  @ApiPropertyOptional({ enum: POSTOS, enumName: 'PostoAluno', nullable: true }) posto?: Posto | null;
  @ApiPropertyOptional({ type: AlojamentoDto, nullable: true }) alojamento?: AlojamentoDto | null;
  @ApiPropertyOptional({ description: 'false inativa; true reativa' }) ativo?: boolean;
}

export class ListaDeTurmasDto {
  @ApiProperty({ type: [String], example: ['T28', 'T27'] }) itens!: string[];
}
