// Contrato planejado da API de Movimentações [Movimentações.RF001 a RF003].
// Dinheiro em centavos; dias em "AAAA-MM-DD". A lista já vem da API (hooks do orval); falta o diálogo
// "Nova movimentação" (Movimentações.RF001).

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
