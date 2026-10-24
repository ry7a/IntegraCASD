import { useState, type FormEvent } from 'react'
import {
  getListarUsuariosQueryKey,
  useAlterarUsuario,
  useCriarUsuario,
  type UsuarioDto,
} from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import Dialogo from '@/compartilhado/componentes/Dialogo'

interface Props {
  aberto: boolean
  usuario: UsuarioDto | null
  aoFechar: () => void
}

function DialogoUsuario({ aberto, usuario, aoFechar }: Props) {
  const [nome, definirNome] = useState(usuario?.nome ?? '')
  const [email, definirEmail] = useState(usuario?.email ?? '')
  const [perfil, definirPerfil] = useState<'ADMINISTRATIVO' | 'DIRETORIA'>(usuario?.perfil ?? 'ADMINISTRATIVO')
  const [ativo, definirAtivo] = useState(usuario?.ativo ?? true)
  const [senha, definirSenha] = useState('')
  const criar = useCriarUsuario()
  const alterar = useAlterarUsuario()
  const queryClient = useQueryClient()
  const mutacao = usuario ? alterar : criar

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    try {
      if (usuario) {
        await alterar.mutateAsync({
          id: usuario.id,
          data: { nome, email, perfil, ativo, ...(senha ? { novaSenha: senha } : {}) },
        })
      } else {
        await criar.mutateAsync({ data: { nome, email, perfil, ativo, senhaInicial: senha } })
      }
      await queryClient.invalidateQueries({ queryKey: getListarUsuariosQueryKey() })
      aoFechar()
    } catch {
      // O erro da API fica visivel no proprio dialogo.
    }
  }

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={usuario ? 'Editar usuario' : 'Novo usuario'}
      descricao="As permissoes do perfil passam a valer no proximo acesso."
      aoEnviar={(evento) => void salvar(evento)}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="botao botao-principal" disabled={mutacao.isPending}>
            {mutacao.isPending ? 'Salvando...' : 'Salvar usuario'}
          </button>
        </>
      }
    >
      <div className="formulario">
        <div className="campo inteiro">
          <label htmlFor="usuario-nome">Nome</label>
          <input id="usuario-nome" required minLength={2} value={nome} onChange={(e) => definirNome(e.target.value)} />
        </div>
        <div className="campo inteiro">
          <label htmlFor="usuario-email">E-mail</label>
          <input id="usuario-email" type="email" required value={email} onChange={(e) => definirEmail(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="usuario-perfil">Perfil</label>
          <select id="usuario-perfil" value={perfil} onChange={(e) => definirPerfil(e.target.value as typeof perfil)}>
            <option value="ADMINISTRATIVO">Administrativo</option>
            <option value="DIRETORIA">Diretoria</option>
          </select>
        </div>
        <label className="campo-check">
          <input type="checkbox" checked={ativo} onChange={(e) => definirAtivo(e.target.checked)} />
          Acesso ativo
        </label>
        <div className="campo inteiro">
          <label htmlFor="usuario-senha">{usuario ? 'Nova senha (opcional)' : 'Senha inicial'}</label>
          <input
            id="usuario-senha"
            type="password"
            autoComplete="new-password"
            required={!usuario}
            minLength={12}
            value={senha}
            onChange={(e) => definirSenha(e.target.value)}
          />
          <span className="dica">Use ao menos 12 caracteres.</span>
        </div>
        {mutacao.error && <p className="erro-formulario inteiro" role="alert">{mutacao.error.message}</p>}
      </div>
    </Dialogo>
  )
}

export default DialogoUsuario
