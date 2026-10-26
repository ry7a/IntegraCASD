// Enquanto o endpoint não existe no NestJS, cada consulta é um hook do TanStack Query que devolve dados fictícios.
// Quando o endpoint existir no NestJS, troca-se cada hook pelo gerado pelo orval, com o mesmo formato.
// Alunos, funcionários, contratos e projetos NÃO estão aqui: já usam os hooks reais, gerados pelo orval.
import { useQuery } from '@tanstack/react-query'
import type { MovimentacoesDoAlunoDto } from './contrato'
import { movimentacoesDoLucas } from './dados-ficticios'

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
