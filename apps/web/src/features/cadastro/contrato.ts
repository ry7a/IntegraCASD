// Contrato planejado da aba Movimentações do aluno. Alunos, funcionários, contratos e projetos já vêm
// da API, pelos hooks do orval. Dinheiro em centavos; dias em "AAAA-MM-DD".
import type { MovimentacaoDto } from '@/compartilhado/dominio'

// GET /api/alunos/:id/movimentacoes
export interface MovimentacoesDoAlunoDto {
  itens: MovimentacaoDto[]
}
