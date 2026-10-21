import { Link } from 'react-router'

function PaginaNaoEncontrada() {
  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Página não encontrada</h1>
          <p>O endereço não existe. Volte ao início e escolha uma opção do menu.</p>
        </div>
        <div className="acoes">
          <Link className="botao botao-principal" to="/">
            Ir para o início
          </Link>
        </div>
      </div>
    </>
  )
}

export default PaginaNaoEncontrada
