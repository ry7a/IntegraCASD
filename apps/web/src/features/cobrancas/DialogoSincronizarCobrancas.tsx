import Dialogo from '@/compartilhado/componentes/Dialogo'
import { formatarDataHora } from '@/compartilhado/formatacao'
import type { SincronizacaoDto } from '@integracasd/api-client'

interface Props {
  aberto: boolean
  aoFechar: () => void
  ultimaSincronizacao: SincronizacaoDto | null
}

// Sincroniza todas as cobranças de um período com o Asaas. [Cobranças.RF007]
function DialogoSincronizarCobrancas({ aberto, aoFechar, ultimaSincronizacao }: Props) {
  function sincronizar() {
    // TODO [Cobranças.RF007]: POST /api/cobrancas/sincronizar (passa pelo Cliente Asaas e grava a execução).
    aoFechar()
  }

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Sincronizar com o Asaas"
      descricao="Consulta o Asaas e atualiza as cobranças cujas notificações não chegaram."
      aoEnviar={(evento) => {
        evento.preventDefault()
        sincronizar()
      }}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>
            Fechar
          </button>
          <button type="submit" className="botao botao-principal">
            Sincronizar agora
          </button>
        </>
      }
    >
      <div className="formulario">
        <div className="campo">
          <label htmlFor="si-de">Vencimento de</label>
          <input id="si-de" type="date" />
        </div>
        <div className="campo">
          <label htmlFor="si-ate">até</label>
          <input id="si-ate" type="date" />
        </div>
      </div>
      {ultimaSincronizacao ? (
        <div className="resumo-efeito">
          <p>
            <strong>Resultado da última sincronização ({formatarDataHora(ultimaSincronizacao.iniciadaEm)})</strong>
          </p>
          <ul className="lista-linhas">
            <li>
              <span>Cobranças conferidas</span>
              <span className="numero">{ultimaSincronizacao.conferidas}</span>
            </li>
            <li>
              <span>Situação atualizada (pagas no Asaas)</span>
              <span className="numero">{ultimaSincronizacao.atualizadas}</span>
            </li>
            <li>
              <span>Encontradas só no Asaas e registradas aqui</span>
              <span className="numero">{ultimaSincronizacao.somenteNoAsaas}</span>
            </li>
            <li>
              <span>Pagas com registro manual, para conferir</span>
              <span className="numero">{ultimaSincronizacao.paraConferir}</span>
            </li>
          </ul>
        </div>
      ) : (
        <p className="texto-apoio">Ainda não houve nenhuma sincronização.</p>
      )}
    </Dialogo>
  )
}

export default DialogoSincronizarCobrancas
