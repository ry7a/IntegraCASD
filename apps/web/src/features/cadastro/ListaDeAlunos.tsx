import { useListarAlunos, type SituacaoAluno } from '@integracasd/api-client'
import { formatarCpf } from '@/compartilhado/formatacao'

// O banco guarda o enum sem acento; o texto exibido fica aqui.
const rotuloDaSituacao: Record<SituacaoAluno, string> = {
  MATRICULADO: 'Matriculado',
  TRANCADO: 'Trancado',
  DESLIGADO: 'Desligado',
  FORMADO: 'Formado',
  INTERCAMBIO: 'Intercâmbio',
}

// Lista de alunos ativos [Cadastros.RF001].
function ListaDeAlunos() {
  // Hook gerado pelo orval: busca GET /api/alunos e guarda no cache do TanStack Query.
  const { data, error, isPending, refetch, isFetching } = useListarAlunos()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Alunos</h1>
        <p className="text-muted-foreground">Alunos ativos, em ordem alfabética.</p>
      </div>

      {isPending && <p role="status">Carregando alunos…</p>}

      {error && (
        <div role="alert" className="space-y-3 rounded-lg border border-destructive bg-card p-4">
          <p>{error.message}</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-md bg-secondary px-4 py-2 font-medium text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
          >
            {isFetching ? 'Tentando…' : 'Tentar de novo'}
          </button>
        </div>
      )}

      {data && data.itens.length === 0 && (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">Nenhum aluno ativo cadastrado.</p>
      )}

      {data && data.itens.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Alunos ativos</caption>
            <thead className="border-b text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Nome</th>
                <th scope="col" className="px-4 py-3 font-medium">CPF</th>
                <th scope="col" className="px-4 py-3 font-medium">E-mail</th>
                <th scope="col" className="px-4 py-3 font-medium">Turma</th>
                <th scope="col" className="px-4 py-3 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {data.itens.map((aluno) => (
                <tr key={aluno.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{aluno.nome}</td>
                  <td className="px-4 py-3 tabular-nums">{formatarCpf(aluno.cpf)}</td>
                  <td className="px-4 py-3">{aluno.email}</td>
                  <td className="px-4 py-3">{aluno.turma ?? '—'}</td>
                  <td className="px-4 py-3">{aluno.situacao ? rotuloDaSituacao[aluno.situacao] : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t px-4 py-3 text-sm text-muted-foreground">
            {data.itens.length} {data.itens.length === 1 ? 'aluno ativo' : 'alunos ativos'}
          </p>
        </div>
      )}
    </div>
  )
}

export default ListaDeAlunos
