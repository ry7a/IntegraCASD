// Mesmo padrão de features/indicadores/consultas.ts: hooks do TanStack Query que devolvem dados fictícios.
// Quando o endpoint existir no NestJS, troca-se cada hook pelo gerado pelo orval, com o mesmo formato.
import { useQuery } from '@tanstack/react-query'
import type { FiltrosDaTrilha, ListaDaTrilhaDto } from './contrato'
import { trilha } from './dados-ficticios'

// Pequeno atraso para a tela mostrar o estado "Carregando…" como mostraria com a API de verdade.
const esperar = () => new Promise((resolver) => setTimeout(resolver, 200))

// TODO [Administração.RF005]: trocar por GET /api/administracao/trilha-auditoria com os mesmos filtros.
export function useListarTrilhaDeAuditoria(filtros: FiltrosDaTrilha) {
  return useQuery<ListaDaTrilhaDto>({
    queryKey: ['administracao', 'trilha-auditoria', filtros],
    queryFn: async () => {
      await esperar()
      const itens = trilha
        .filter((r) => !filtros.de || r.ocorridoEm.slice(0, 10) >= filtros.de)
        .filter((r) => !filtros.ate || r.ocorridoEm.slice(0, 10) <= filtros.ate)
        .filter((r) => {
          if (!filtros.usuario) return true
          if (filtros.usuario === 'ROTINA_AUTOMATICA') return r.usuarioNome === null
          return r.usuarioNome === filtros.usuario
        })
        .filter((r) => !filtros.operacao || r.operacao === filtros.operacao)
        .filter((r) => !filtros.entidade || r.entidade === filtros.entidade)
      return { itens, total: itens.length }
    },
  })
}
