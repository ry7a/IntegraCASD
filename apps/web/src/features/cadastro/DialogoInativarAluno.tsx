import {
  getBuscarAlunoQueryKey,
  getListarAlunosQueryKey,
  useAlterarAluno,
  useListarCobrancasDoAluno,
  type AlunoDto,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarMoeda } from '@/compartilhado/formatacao'
import { debitoDoAluno } from './debito-do-aluno'

interface Props {
  aoFechar: () => void
  aluno: AlunoDto
}

function textoDasVencidas(quantidade: number) {
  return quantidade === 1 ? '1 cobrança vencida' : `${quantidade} cobranças vencidas`
}

// Operação com efeitos: passa pelo diálogo de confirmação, que mostra o resumo do efeito ([Usabilidade.NF003]).
// [Cadastros.RF001] fluxo A1. O cadastro não é excluído: fica inativo e pode ser reativado.
function DialogoInativarAluno({ aoFechar, aluno }: Props) {
  // [Cadastros.RF001] fluxo E2: com cobrança aberta ou vencida, o diálogo mostra o débito antes da confirmação.
  const cobrancas = useListarCobrancasDoAluno(aluno.id)
  const debito = debitoDoAluno(cobrancas.data)
  // Enquanto a consulta das cobranças não termina, a confirmação fica desabilitada: quem clicasse rápido
  // inativaria antes de o aviso de débito aparecer. Se a consulta falhar, o diálogo avisa que não conferiu
  // o débito e libera a confirmação (não bloqueia para sempre).
  const conferindoDebito = cobrancas.isPending
  const alterar = useAlterarAluno()
  const queryClient = useQueryClient()

  let textoDoBotao = 'Inativar aluno'
  if (conferindoDebito) textoDoBotao = 'Conferindo débito…'
  if (alterar.isPending) textoDoBotao = 'Inativando…'

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
        if (conferindoDebito) return
        void confirmar()
      }}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Voltar
          </button>
          <button type="submit" className="botao botao-destrutivo" disabled={conferindoDebito || alterar.isPending}>
            {textoDoBotao}
          </button>
        </>
      }
    >
      {conferindoDebito && (
        <p className="texto-apoio" role="status">
          Conferindo se o aluno tem cobrança aberta ou vencida…
        </p>
      )}
      {cobrancas.isError && (
        <div className="aviso aviso-perigo" role="alert">
          <Icone nome="alerta" />
          <span>
            <strong>Não foi possível conferir se o aluno tem débito.</strong> Antes de inativar, confira as cobranças
            na aba Cobranças do aluno, ou feche o diálogo e tente de novo.
          </span>
        </div>
      )}
      {debito && (
        <div className="aviso aviso-perigo">
          <Icone nome="alerta" />
          <span>
            <strong>Este aluno tem débito:</strong> {formatarMoeda(debito.totalEmAbertoCentavos)} em aberto
            {debito.quantidadeVencidas === 0 ? (
              <>, ainda sem cobrança vencida.</>
            ) : (
              <>
                , dos quais {formatarMoeda(debito.totalVencidoCentavos)} em {textoDasVencidas(debito.quantidadeVencidas)}.
              </>
            )}
          </span>
        </div>
      )}
      <div className="resumo-efeito">
        <dl>
          <dt>Aluno</dt>
          <dd>{aluno.nome}</dd>
          {debito && (
            <>
              <dt>Total em aberto</dt>
              <dd>{formatarMoeda(debito.totalEmAbertoCentavos)}</dd>
            </>
          )}
          {debito && debito.quantidadeVencidas > 0 && (
            <>
              <dt>Cobranças vencidas</dt>
              <dd>
                {debito.quantidadeVencidas} · {formatarMoeda(debito.totalVencidoCentavos)}
              </dd>
            </>
          )}
        </dl>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {debito && (
            <li>
              As cobranças abertas e vencidas <strong>não são canceladas</strong> e continuam como débito do aluno.
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
