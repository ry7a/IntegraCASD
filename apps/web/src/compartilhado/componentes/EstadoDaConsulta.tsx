import type { ReactNode } from 'react'
import Icone from './Icone'

interface EstadoDaConsultaProps {
  carregando: boolean
  erro: unknown
  aoTentarDeNovo?: () => void
  // Quando verdadeiro, mostra a mensagem de "nada encontrado" no lugar do conteúdo.
  vazio?: boolean
  mensagemVazia?: string
  children: ReactNode
}

// Os três estados que toda consulta à API precisa tratar: carregando, erro e vazio.
// A mensagem de erro vem pronta da API (ErroDaApi); aqui só a mostramos.
function EstadoDaConsulta({
  carregando,
  erro,
  aoTentarDeNovo,
  vazio,
  mensagemVazia = 'Nada encontrado.',
  children,
}: EstadoDaConsultaProps) {
  if (carregando) {
    return (
      <p className="texto-apoio" role="status">
        Carregando…
      </p>
    )
  }
  if (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : 'Algo deu errado. Tente de novo em instantes.'
    return (
      <div className="alerta" role="alert">
        <Icone nome="alerta" />
        <p>{mensagem}</p>
        {aoTentarDeNovo && (
          <button type="button" className="botao botao-pequeno" onClick={aoTentarDeNovo}>
            Tentar de novo
          </button>
        )}
      </div>
    )
  }
  if (vazio) return <p className="texto-apoio">{mensagemVazia}</p>
  return <>{children}</>
}

export default EstadoDaConsulta
