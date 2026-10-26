import {
  getBuscarAlunoQueryKey,
  getListarAlunosQueryKey,
  useAlterarAluno,
  type AlunoDto,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarMoeda } from '@/compartilhado/formatacao'
import { useListarCobrancasDoAluno } from './consultas'

interface Props {
  aoFechar: () => void
  aluno: AlunoDto
}

// Operação com efeitos: passa pelo diálogo de confirmação, que mostra o resumo do efeito ([Usabilidade.NF003]).
// [Cadastros.RF001] fluxo A1. O cadastro não é excluído: fica inativo e pode ser reativado.
function DialogoInativarAluno({ aoFechar, aluno }: Props) {
  // TODO [Cadastros.RF001] fluxo E2: as cobranças ainda são fictícias; o aviso de débito passa a ser real
  // quando o módulo de Cobranças entregar GET /api/alunos/:id/cobrancas.
  const cobrancas = useListarCobrancasDoAluno(aluno.id)
  const dados = cobrancas.data
  const temDebito = !!dados && dados.quantidadeVencidas > 0
  const alterar = useAlterarAluno()
  const queryClient = useQueryClient()

  async function confirmar() {
    try {
      const inativado = await alterar.mutateAsync({ id: aluno.id, data: { ativo: false } })
      queryClient.setQueryData(getBuscarAlunoQueryKey(aluno.id), inativado)
      await queryClient.invalidateQueries({ queryKey: getListarAlunosQueryKey() })
      aoFechar()
    } catch {
      // A mensagem da API aparece no próprio diálogo.
    }
  }

  return (
    <Dialogo
      aberto
      aoFechar={aoFechar}
      titulo="Inativar aluno?"
      descricao="O cadastro não é excluído: ele fica inativo e pode ser reativado depois."
      aoEnviar={(evento) => {
        evento.preventDefault()
        void confirmar()
      }}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Voltar
          </button>
          <button type="submit" className="botao botao-destrutivo" disabled={alterar.isPending}>
            {alterar.isPending ? 'Inativando…' : 'Inativar aluno'}
          </button>
        </>
      }
    >
      {temDebito && (
        <div className="aviso aviso-perigo">
          <Icone nome="alerta" />
          <span>
            <strong>Este aluno tem débito:</strong> {dados.quantidadeVencidas} cobranças vencidas, somando{' '}
            {formatarMoeda(dados.totalEmAbertoCentavos)}.
          </span>
        </div>
      )}
      <div className="resumo-efeito">
        <dl>
          <dt>Aluno</dt>
          <dd>{aluno.nome}</dd>
          {temDebito && (
            <>
              <dt>Cobranças vencidas</dt>
              <dd>
                {dados.quantidadeVencidas} · {formatarMoeda(dados.totalEmAbertoCentavos)}
              </dd>
            </>
          )}
        </dl>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {temDebito && (
            <li>
              As cobranças vencidas <strong>não são canceladas</strong> e continuam contando na inadimplência.
            </li>
          )}
          <li>
            Ele <strong>deixa de receber a mensalidade automática</strong>.
          </li>
          <li>A vaga do alojamento fica livre para outro aluno ativo.</li>
          <li>O cadastro e o histórico continuam consultáveis.</li>
        </ul>
      </div>
      {alterar.error && (
        <p className="erro-formulario" role="alert">
          {alterar.error.message}
        </p>
      )}
    </Dialogo>
  )
}

export default DialogoInativarAluno
