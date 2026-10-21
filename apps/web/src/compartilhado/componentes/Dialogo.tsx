import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react'
import Icone from './Icone'

interface DialogoProps {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  descricao?: string
  children: ReactNode
  // Botões do rodapé. Use type="button" para cancelar e type="submit" para a ação principal.
  rodape: ReactNode
  // O que fazer ao enviar o formulário do diálogo. Sem isto, só fecha (as ações ainda não têm efeito).
  aoEnviar?: (evento: FormEvent<HTMLFormElement>) => void
}

// Diálogo com o elemento nativo <dialog>: o navegador já cuida do foco, do fundo escurecido e da
// tecla Esc. `aberto` é controlado pela tela; o <dialog> só precisa ser aberto com showModal().
function Dialogo({ aberto, aoFechar, titulo, descricao, children, rodape, aoEnviar }: DialogoProps) {
  const referencia = useRef<HTMLDialogElement>(null)
  const idDoTitulo = useId()

  useEffect(() => {
    const dialogo = referencia.current
    if (!dialogo) return
    if (aberto && !dialogo.open) dialogo.showModal()
    if (!aberto && dialogo.open) dialogo.close()
  }, [aberto])

  function aoEnviarPadrao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    aoFechar()
  }

  return (
    // onClose dispara quando o diálogo fecha (inclusive pela tecla Esc): mantém o estado da tela em dia.
    <dialog ref={referencia} aria-labelledby={idDoTitulo} onClose={aoFechar}>
      <form onSubmit={aoEnviar ?? aoEnviarPadrao} noValidate>
        <div className="dialogo-cabecalho">
          <div>
            <h2 id={idDoTitulo}>{titulo}</h2>
            {descricao && <p>{descricao}</p>}
          </div>
          <button
            type="button"
            className="botao botao-fantasma botao-pequeno"
            aria-label="Fechar"
            onClick={aoFechar}
          >
            <Icone nome="fechar" />
          </button>
        </div>
        <div className="dialogo-corpo">{children}</div>
        <div className="dialogo-rodape">{rodape}</div>
      </form>
    </dialog>
  )
}

export default Dialogo
