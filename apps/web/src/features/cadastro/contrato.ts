// Contrato planejado da API de Cadastros [Cadastros.RF005] e da aba Movimentações do
// aluno. Alunos, funcionários e contratos já vêm da API, pelos hooks do orval. Dinheiro em centavos; dias em "AAAA-MM-DD".
import type { MovimentacaoDto } from '@/compartilhado/dominio'

// GET /api/alunos/:id/movimentacoes
export interface MovimentacoesDoAlunoDto {
  itens: MovimentacaoDto[]
}

export interface ProjetoDto {
  id: string
  nome: string
  responsavel: string
  dataInicio: string
  dataFim: string
  // Nulo = sem orçamento previsto.
  orcamentoCentavos: number | null
  situacao: 'EM_ANDAMENTO' | 'ENCERRADO'
  // Soma das movimentações ligadas ao projeto (dado de Movimentações, entregue pela API junto do projeto).
  movimentadoCentavos: number
}

export type SituacaoDoFiltroDeProjetos = 'em-andamento' | 'encerrados' | 'todos'

// GET /api/projetos?situacao=em-andamento|encerrados|todos
export interface ListaDeProjetosDto {
  itens: ProjetoDto[]
}
