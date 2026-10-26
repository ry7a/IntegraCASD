// Contrato planejado da API de Movimentações [Movimentações.RF001 a RF003].
// Dinheiro em centavos; dias em "AAAA-MM-DD". O MovimentacaoDto fica em compartilhado/dominio.ts
// porque a aba "Movimentações" do aluno também o usa.
import type { FormaPagamento, MovimentacaoDto, TipoMovimentacao } from '@/compartilhado/dominio'

export interface TotaisDto {
  // Estornos não entram: o estorno e a original se anulam.
  entradasCentavos: number
  quantidadeEntradas: number
  saidasCentavos: number
  quantidadeSaidas: number
  saldoCentavos: number
}

// GET /api/movimentacoes?mes=AAAA-MM&tipo=&categoriaId=&forma=&ocultarEstornos=
// TODO [Movimentações.RF003]: a API de verdade também recebe pagina e tamanhoPagina e filtra por projeto ou contrato.
export interface ListaDeMovimentacoesDto {
  itens: MovimentacaoDto[]
  total: number
  // Totais do mesmo recorte da lista, de todas as páginas.
  totais: TotaisDto
}

// Os filtros da lista, iguais aos parâmetros da rota acima.
export interface FiltrosDeMovimentacoes {
  mes: string
  tipo?: TipoMovimentacao
  categoriaId?: string
  forma?: FormaPagamento
  ocultarEstornos?: boolean
}

export interface CategoriaDto {
  id: string
  nome: string
}

export interface ContratoParaVincularDto {
  id: string
  nome: string
  valorCentavos: number
  periodicidade: 'MENSAL' | 'ANUAL' | 'POR_DEMANDA' | 'UNICA'
  // Soma das saídas já pagas neste contrato no ano.
  pagoNoAnoCentavos: number
}

export interface OpcaoDeVinculoDto {
  id: string
  nome: string
}

// GET /api/movimentacoes/opcoes
// As listas que o filtro e o diálogo "Nova movimentação" precisam: categorias ativas e os contratos vigentes,
// projetos em andamento e funcionários ativos a que a movimentação pode ser vinculada.
export interface OpcoesDaMovimentacaoDto {
  categorias: CategoriaDto[]
  contratos: ContratoParaVincularDto[]
  projetos: OpcaoDeVinculoDto[]
  funcionarios: OpcaoDeVinculoDto[]
}
