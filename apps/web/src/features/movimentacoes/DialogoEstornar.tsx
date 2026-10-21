import Dialogo from '@/compartilhado/componentes/Dialogo'
import { ROTULO_DA_FORMA, type MovimentacaoDto } from '@/compartilhado/dominio'
import { formatarData, formatarMoeda, formatarMoedaComSinal } from '@/compartilhado/formatacao'

interface Props {
  movimentacao: MovimentacaoDto | null
  aoFechar: () => void
}

// Estornar movimentação [Movimentações.RF002]: operação irreversível, com resumo do efeito.
function DialogoEstornar({ movimentacao, aoFechar }: Props) {
  function confirmar() {
    // TODO [Movimentações.RF002]: POST /api/movimentacoes/:id/estornar, com motivo. Numa transação, marca a
    // original como estornada e cria o espelho; se marcado, abre "Nova movimentação" para lançar a correta.
    aoFechar()
  }

  const sinalOposto = movimentacao?.tipo === 'SAIDA' ? '+' : '−'

  return (
    <Dialogo
      aberto={movimentacao !== null}
      aoFechar={aoFechar}
      titulo="Estornar movimentação?"
      descricao="Esta operação não pode ser desfeita."
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
            Estornar
          </button>
        </>
      }
    >
      {movimentacao && (
        <div className="resumo-efeito">
          <dl>
            <dt>Movimentação</dt>
            <dd>{movimentacao.descricao}</dd>
            <dt>Valor</dt>
            <dd>
              {formatarMoedaComSinal(movimentacao.tipo, movimentacao.valorCentavos)} · {ROTULO_DA_FORMA[movimentacao.forma]} ·{' '}
              {formatarData(movimentacao.data)}
            </dd>
            {movimentacao.vinculo?.nome && (
              <>
                <dt>Vínculo</dt>
                <dd>
                  {movimentacao.vinculo.tipo === 'CONTRATO' ? 'Contrato' : 'Projeto'} · {movimentacao.vinculo.nome}
                </dd>
              </>
            )}
          </dl>
          <p>
            A movimentação original continua visível, marcada como estornada. Será criada uma{' '}
            {movimentacao.tipo === 'SAIDA' ? 'entrada' : 'saída'} de{' '}
            <strong>
              {sinalOposto} {formatarMoeda(movimentacao.valorCentavos)}
            </strong>{' '}
            que anula o efeito dela no saldo.
          </p>
        </div>
      )}
      <div className="campo">
        <label htmlFor="es-motivo">Motivo do estorno</label>
        <textarea id="es-motivo" placeholder="Ex.: valor lançado errado, o correto é R$ 1.020,00" />
      </div>
      <label className="campo-check">
        <input type="checkbox" defaultChecked />
        Lançar a movimentação correta em seguida
      </label>
    </Dialogo>
  )
}

export default DialogoEstornar
