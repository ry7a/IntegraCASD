// Mesmo padrão de features/indicadores/consultas.ts: hooks do TanStack Query que devolvem dados fictícios.
// Quando o endpoint existir no NestJS, troca-se cada hook pelo gerado pelo orval, com o mesmo formato.
import { useQuery } from '@tanstack/react-query'
import type { FiltrosDeMovimentacoes, ListaDeMovimentacoesDto, OpcoesDaMovimentacaoDto } from './contrato'
import { movimentacoes, opcoes, totais } from './dados-ficticios'

// Pequeno atraso para a tela mostrar o estado "Carregando…" como mostraria com a API de verdade.
const esperar = () => new Promise((resolver) => setTimeout(resolver, 200))

// TODO [Movimentações.RF003]: trocar por GET /api/movimentacoes com os mesmos filtros (o filtro de verdade é feito no backend).
export function useListarMovimentacoes(filtros: FiltrosDeMovimentacoes) {
  return useQuery<ListaDeMovimentacoesDto>({
    queryKey: ['movimentacoes', 'lista', filtros],
    queryFn: async () => {
      await esperar()
      const categoria = opcoes.categorias.find((c) => c.id === filtros.categoriaId)?.nome
      const itens = movimentacoes
        .filter((m) => m.data.startsWith(filtros.mes))
        .filter((m) => !filtros.tipo || m.tipo === filtros.tipo)
        .filter((m) => !categoria || m.categoriaNome === categoria)
        .filter((m) => !filtros.forma || m.forma === filtros.forma)
        .filter((m) => !filtros.ocultarEstornos || (m.origem !== 'ESTORNO' && m.estornadaEm === null))
      // Os totais do mockup valem para o mês todo e não mudam com os filtros desta amostra.
      return { itens, total: itens.length, totais }
    },
  })
}

// TODO [Movimentações.RF001]: trocar por GET /api/movimentacoes/opcoes.
export function useOpcoesDaMovimentacao() {
  return useQuery<OpcoesDaMovimentacaoDto>({
    queryKey: ['movimentacoes', 'opcoes'],
    queryFn: async () => {
      await esperar()
      return opcoes
    },
  })
}
