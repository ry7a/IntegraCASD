// Mesmo padrão de features/indicadores/consultas.ts: hooks do TanStack Query que devolvem dados fictícios.
// Quando o endpoint existir no NestJS, troca-se cada hook pelo gerado pelo orval, com o mesmo formato.
import { useQuery } from '@tanstack/react-query'
import type { OpcoesDaMovimentacaoDto } from './contrato'
import { opcoes } from './dados-ficticios'

// Pequeno atraso para a tela mostrar o estado "Carregando…" como mostraria com a API de verdade.
const esperar = () => new Promise((resolver) => setTimeout(resolver, 200))

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
