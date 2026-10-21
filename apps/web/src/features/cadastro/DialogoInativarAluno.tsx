import Dialogo from '@/compartilhado/componentes/Dialogo'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarMoeda } from '@/compartilhado/formatacao'
import { useListarCobrancasDoAluno } from './consultas'
import type { AlunoDetalheDto } from './contrato'

interface Props {
  aberto: boolean
  aoFechar: () => void
  aluno: AlunoDetalheDto
}

// Operação com efeitos: passa pelo diálogo de confirmação, que mostra o resumo do efeito ([Usabilidade.NF003]).
function DialogoInativarAluno({ aberto, aoFechar, aluno }: Props) {
  const cobrancas = useListarCobrancasDoAluno(aluno.id, { enabled: aberto })
  const dados = cobrancas.data
  const temDebito = !!dados && dados.quantidadeVencidas > 0

  function confirmar() {
    // TODO [Cadastros.RF001]: PUT /api/alunos/:id/inativar (com auditoria). O cadastro não é excluído.
    aoFechar()
  }

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Inativar aluno?"
      descricao="O cadastro não é excluído: ele fica inativo."
      aoEnviar={(evento) => {
        evento.preventDefault()
        confirmar()
      }}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Voltar
          </button>
          <button type="submit" className="botao botao-destrutivo">
            Inativar aluno
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
          <li>O cadastro e o histórico continuam consultáveis.</li>
        </ul>
      </div>
    </Dialogo>
  )
}

export default DialogoInativarAluno
