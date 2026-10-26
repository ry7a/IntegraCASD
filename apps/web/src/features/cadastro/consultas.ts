// Mesmo padrão de features/indicadores/consultas.ts: hooks do TanStack Query que devolvem dados fictícios.
// Quando o endpoint existir no NestJS, troca-se cada hook pelo gerado pelo orval, com o mesmo formato.
// A lista de alunos (useListarAlunos) NÃO está aqui: já é o hook real, gerado pelo orval.
import { useQuery } from '@tanstack/react-query'
import type {
  CobrancasDoAlunoDto,
  ListaDeContratosDto,
  ListaDeFuncionariosDto,
  ListaDeProjetosDto,
  MovimentacoesDoAlunoDto,
  SituacaoDoFiltroDeContratos,
  SituacaoDoFiltroDeProjetos,
} from './contrato'
import {
  cobrancasDoLucas,
  contratos,
  funcionarios,
  movimentacoesDoLucas,
  projetos,
} from './dados-ficticios'

// Pequeno atraso para a tela mostrar o estado "Carregando…" como mostraria com a API de verdade.
const esperar = () => new Promise((resolver) => setTimeout(resolver, 200))

// TODO [Cadastros.RF001]: trocar por GET /api/alunos/:id/cobrancas.
export function useListarCobrancasDoAluno(alunoId: string, opcoes?: { enabled: boolean }) {
  return useQuery<CobrancasDoAlunoDto>({
    queryKey: ['alunos', alunoId, 'cobrancas'],
    queryFn: async () => {
      await esperar()
      if (alunoId === 'aluno-lucas') return cobrancasDoLucas
      return { itens: [], totalEmAbertoCentavos: 0, quantidadeVencidas: 0 }
    },
    enabled: opcoes?.enabled,
  })
}

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

// TODO [Cadastros.RF002]: trocar por GET /api/funcionarios?busca=.
export function useListarFuncionarios(busca: string) {
  return useQuery<ListaDeFuncionariosDto>({
    queryKey: ['funcionarios', busca],
    queryFn: async () => {
      await esperar()
      const texto = busca.trim().toLowerCase()
      return { itens: funcionarios.filter((f) => f.nome.toLowerCase().includes(texto)) }
    },
  })
}

// TODO [Cadastros.RF004]: trocar por GET /api/contratos?situacao=.
export function useListarContratos(situacao: SituacaoDoFiltroDeContratos) {
  return useQuery<ListaDeContratosDto>({
    queryKey: ['contratos', situacao],
    queryFn: async () => {
      await esperar()
      const itens = contratos.filter((c) => {
        if (situacao === 'vigentes') return c.situacao !== 'ENCERRADO'
        if (situacao === 'encerrados') return c.situacao === 'ENCERRADO'
        return true
      })
      return { itens, quantidadeVencendo: contratos.filter((c) => c.situacao === 'VENCE_EM_BREVE').length }
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
