import { useState, type FormEvent } from 'react'
import { getBuscarSessaoQueryKey, useEntrar } from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'

function PaginaLogin() {
  const [email, definirEmail] = useState('')
  const [senha, definirSenha] = useState('')
  const entrar = useEntrar()
  const queryClient = useQueryClient()
  const navegar = useNavigate()

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    try {
      const usuario = await entrar.mutateAsync({ data: { email, senha } })
      queryClient.setQueryData(getBuscarSessaoQueryKey(), usuario)
      navegar('/', { replace: true })
    } catch {
      // A mensagem orientada a acao e exibida abaixo do formulario.
    }
  }

  return (
    <main className="pagina-login">
      <section className="cartao-login" aria-labelledby="titulo-login">
        <div className="marca marca-login">
          <span className="marca-selo">CASD</span>
          <span className="marca-nome">IntegraCASD</span>
        </div>
        <h1 id="titulo-login">Entrar</h1>
        <p>Acesse a gestao financeira do CASD com seu e-mail e senha.</p>
        <form onSubmit={(evento) => void enviar(evento)}>
          <div className="campo">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(evento) => definirEmail(evento.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="login-senha">Senha</label>
            <input
              id="login-senha"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(evento) => definirSenha(evento.target.value)}
            />
          </div>
          {entrar.error && <p className="erro-formulario" role="alert">{entrar.error.message}</p>}
          <button type="submit" className="botao botao-principal" disabled={entrar.isPending}>
            {entrar.isPending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default PaginaLogin
