// Contrato planejado da API de Cadastros [Cadastros.RF001 a RF005], além da lista de alunos que já existe
// (GET /api/alunos, hook real do orval). Dinheiro em centavos; dias em "AAAA-MM-DD".
import type { SituacaoAluno } from '@integracasd/api-client'
import type { MovimentacaoDto, SituacaoCobranca } from '@/compartilhado/dominio'

// GET /api/alunos/:id
export interface AlunoDetalheDto {
  id: string
  nome: string
  // Só dígitos, sem pontuação (11 caracteres).
  cpf: string
  // Vazio quando o cadastro está incompleto.
  email: string
  turma: string | null
  // Aluno inativo não recebe a mensalidade automática.
  ativo: boolean
  situacao: SituacaoAluno | null
  dataNascimento: string | null
  celular: string | null
}

export interface CobrancaDoAlunoDto {
  id: string
  descricao: string
  valorCentavos: number
  vencimento: string
  situacao: SituacaoCobranca
  diasDeAtraso: number | null
  pagaEm: string | null
}

// GET /api/alunos/:id/cobrancas
export interface CobrancasDoAlunoDto {
  itens: CobrancaDoAlunoDto[]
  // Soma das cobranças vencidas.
  totalEmAbertoCentavos: number
  quantidadeVencidas: number
}

// GET /api/alunos/:id/movimentacoes
export interface MovimentacoesDoAlunoDto {
  itens: MovimentacaoDto[]
}

export interface FuncionarioDto {
  id: string
  nome: string
  cargo: string
  dataAdmissao: string
  dataDesligamento: string | null
  ativo: boolean
}

// GET /api/funcionarios?busca=
export interface ListaDeFuncionariosDto {
  itens: FuncionarioDto[]
}

export type PeriodicidadeContrato = 'MENSAL' | 'ANUAL' | 'POR_DEMANDA' | 'UNICA'

export interface ContratoDto {
  id: string
  // Nome de quem contratamos (texto livre; não há cadastro de fornecedores).
  contraparte: string
  objeto: string
  // Valor previsto por periodicidade.
  valorCentavos: number
  periodicidade: PeriodicidadeContrato
  dataInicio: string
  dataFim: string
  situacao: 'VIGENTE' | 'VENCE_EM_BREVE' | 'ENCERRADO'
  // Dias até o término; negativo se já encerrou.
  diasParaVencer: number
  // Soma das saídas já pagas neste contrato no ano (dado de Movimentações, entregue pela API junto do contrato).
  pagoNoAnoCentavos: number
}

export type SituacaoDoFiltroDeContratos = 'vigentes' | 'encerrados' | 'todos'

// GET /api/contratos?situacao=vigentes|encerrados|todos
export interface ListaDeContratosDto {
  itens: ContratoDto[]
  // Quantos contratos vencem nos próximos 60 dias (aviso da tela).
  quantidadeVencendo: number
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
