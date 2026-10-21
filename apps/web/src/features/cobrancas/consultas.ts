// Mesmo padrão de features/indicadores/consultas.ts: hooks do TanStack Query que devolvem dados fictícios.
// Quando o endpoint existir no NestJS, troca-se cada hook pelo gerado pelo orval, com o mesmo formato.
import { useQuery } from '@tanstack/react-query'
import type { CobrancaDetalheDto, FiltrosDeCobrancas, ListaDeCobrancasDto, ResumoCobrancasDto } from './contrato'
import { cobrancasDaLista, cobrancasDetalhadas, resumo } from './dados-ficticios'

// Pequeno atraso para a tela mostrar o estado "Carregando…" como mostraria com a API de verdade.
const esperar = () => new Promise((resolver) => setTimeout(resolver, 200))

// TODO [Cobranças.RF002]: trocar por GET /api/cobrancas com os mesmos filtros (o filtro de verdade é feito no backend).
export function useListarCobrancas(filtros: FiltrosDeCobrancas) {
  return useQuery<ListaDeCobrancasDto>({
    queryKey: ['cobrancas', 'lista', filtros],
    queryFn: async () => {
      await esperar()
      const busca = filtros.busca?.trim().toLowerCase()
      const itens = cobrancasDaLista
        .filter((c) => filtros.situacoes.includes(c.situacao))
        .filter((c) => !busca || c.alunoNome.toLowerCase().includes(busca))
        .filter((c) => !filtros.vencimentoDe || c.vencimento >= filtros.vencimentoDe)
        .filter((c) => !filtros.vencimentoAte || c.vencimento <= filtros.vencimentoAte)
        .filter((c) => filtros.valorMinimoCentavos === undefined || c.valorCentavos >= filtros.valorMinimoCentavos)
        .filter((c) => filtros.valorMaximoCentavos === undefined || c.valorCentavos <= filtros.valorMaximoCentavos)
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      return { itens, total: itens.length }
    },
  })
}

// TODO [Cobranças.RF002]: trocar por GET /api/cobrancas/resumo.
export function useResumoDasCobrancas() {
  return useQuery<ResumoCobrancasDto>({
    queryKey: ['cobrancas', 'resumo'],
    queryFn: async () => {
      await esperar()
      return resumo
    },
  })
}

// TODO [Cobranças.RF003]: trocar por GET /api/cobrancas/:id.
export function useBuscarCobranca(id: string) {
  return useQuery<CobrancaDetalheDto>({
    queryKey: ['cobrancas', 'detalhe', id],
    queryFn: async () => {
      await esperar()
      const cobranca = cobrancasDetalhadas.find((c) => c.id === id)
      if (!cobranca) throw new Error('Cobrança não encontrada. Volte à lista e escolha outra cobrança.')
      return cobranca
    },
    retry: false,
  })
}
