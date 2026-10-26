// Mesmo padrão de features/indicadores/consultas.ts: hooks do TanStack Query que devolvem dados fictícios.
// Quando o endpoint existir no NestJS, troca-se cada hook pelo gerado pelo orval, com o mesmo formato.
// Alunos e funcionários NÃO estão aqui: já usam os hooks reais, gerados pelo orval.
import { useQuery } from '@tanstack/react-query'
import type {
  ListaDeProjetosDto,
  MovimentacoesDoAlunoDto,
  SituacaoDoFiltroDeProjetos,
} from './contrato'
import {
  movimentacoesDoLucas,
  projetos,
} from './dados-ficticios'

// Pequeno atraso para a tela mostrar o estado "Carregando…" como mostraria com a API de verdade.
const esperar = () => new Promise((resolver) => setTimeout(resolver, 200))

// TODO [Cadastros.RF001]: trocar por GET /api/alunos/:id/movimentacoes.
export function useListarMovimentacoesDoAluno(alunoId: string) {
  return useQuery<MovimentacoesDoAlunoDto>({
    queryKey: ['alunos', alunoId, 'movimentacoes'],
    queryFn: async () => {
      await esperar()
      return { itens: alunoId === 'aluno-lucas' ? movimentacoesDoLucas : [] }
    },
  })
}

// TODO [Cadastros.RF005]: trocar por GET /api/projetos?situacao=.
export function useListarProjetos(situacao: SituacaoDoFiltroDeProjetos) {
  return useQuery<ListaDeProjetosDto>({
    queryKey: ['projetos', situacao],
    queryFn: async () => {
      await esperar()
      const itens = projetos.filter((p) => {
        if (situacao === 'em-andamento') return p.situacao === 'EM_ANDAMENTO'
        if (situacao === 'encerrados') return p.situacao === 'ENCERRADO'
        return true
      })
      return { itens }
    },
  })
}
