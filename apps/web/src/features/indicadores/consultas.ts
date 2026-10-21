// Padrão novo para a equipe: enquanto o endpoint não existe no NestJS, cada consulta é um hook do TanStack
// Query que devolve dados fictícios (dados-ficticios.ts). Quando o endpoint existir, troca-se o hook
// por um com o MESMO nome e formato, gerado pelo orval; as telas não mudam.
import { useQuery } from '@tanstack/react-query'
import type { EvolucaoDto, GastosPorCategoriaDto, InadimplenciaDto, ResumoIndicadoresDto } from './contrato'
import { evolucao, gastosPorCategoria, inadimplencia, resumo } from './dados-ficticios'

// Pequeno atraso para a tela mostrar o estado "Carregando…" como mostraria com a API de verdade.
const esperar = () => new Promise((resolver) => setTimeout(resolver, 200))

// TODO [Indicadores.RF001]: trocar por GET /api/indicadores/resumo?mes=AAAA-MM quando o endpoint existir.
export function useResumoDosIndicadores() {
  return useQuery<ResumoIndicadoresDto>({
    queryKey: ['indicadores', 'resumo'],
    queryFn: async () => {
      await esperar()
      return resumo
    },
  })
}

// TODO [Indicadores.RF001]: trocar por GET /api/indicadores/evolucao?ate=AAAA-MM&quantidade=6.
export function useEvolucaoDeEntradasESaidas() {
  return useQuery<EvolucaoDto>({
    queryKey: ['indicadores', 'evolucao'],
    queryFn: async () => {
      await esperar()
      return evolucao
    },
  })
}

// TODO [Indicadores.RF002]: trocar por GET /api/indicadores/inadimplencia.
export function useInadimplencia() {
  return useQuery<InadimplenciaDto>({
    queryKey: ['indicadores', 'inadimplencia'],
    queryFn: async () => {
      await esperar()
      return inadimplencia
    },
  })
}

// TODO [Indicadores.RF003]: trocar por GET /api/indicadores/gastos-por-categoria?mes=AAAA-MM.
export function useGastosPorCategoria() {
  return useQuery<GastosPorCategoriaDto>({
    queryKey: ['indicadores', 'gastos-por-categoria'],
    queryFn: async () => {
      await esperar()
      return gastosPorCategoria
    },
  })
}
