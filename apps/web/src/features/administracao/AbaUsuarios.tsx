import { useState } from 'react'
import { useListarUsuarios, type UsuarioDto } from '@integracasd/api-client'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarDataHora } from '@/compartilhado/formatacao'
import { useUsuarioAtual } from '@/compartilhado/use-usuario-atual'
import type { PerfilUsuario } from './contrato'
import DialogoUsuario from './DialogoUsuario'

const ROTULO_DO_PERFIL: Record<PerfilUsuario, string> = {
  DIRETORIA: 'Diretoria',
  ADMINISTRATIVO: 'Administrativo',
}

// Usuários e permissões. [Administração.RF001]
function AbaUsuarios() {
  const consulta = useListarUsuarios()
  const itens = consulta.data?.itens ?? []
  const usuarioAtual = useUsuarioAtual()
  const [dialogoAberto, definirDialogoAberto] = useState(false)
  const [usuarioEmEdicao, definirUsuarioEmEdicao] = useState<UsuarioDto | null>(null)

  function abrirDialogo(usuario: UsuarioDto | null) {
    definirUsuarioEmEdicao(usuario)
    definirDialogoAberto(true)
  }

  return (
    <>
      <div className="filtros">
        <p className="texto-apoio" style={{ margin: 0 }}>
          A diretoria tem todas as permissões do administrativo, mais esta área. Ao trocar de gestão, deixe ao menos um
          usuário de diretoria ativo.
        </p>
        <div className="campo" style={{ marginLeft: 'auto' }}>
          <button type="button" className="botao botao-principal" onClick={() => abrirDialogo(null)}>
            <Icone nome="mais" />
            Novo usuário
          </button>
        </div>
      </div>
      <EstadoDaConsulta
        carregando={consulta.isPending}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        vazio={itens.length === 0}
        mensagemVazia="Nenhum usuário cadastrado."
      >
        <div className="tabela-envoltorio">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Situação</th>
                <th>Último acesso</th>
                <th>
                  <span hidden>Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((usuario) => {
                const ehVoce = usuario.id === usuarioAtual.id
                const secundario = ehVoce ? 'Você' : null
                return (
                  <tr key={usuario.id}>
                    <td>
                      <span className="nome-principal">{usuario.nome}</span>
                      {secundario && <span className="secundario">{secundario}</span>}
                    </td>
                    <td>{usuario.email}</td>
                    <td>{ROTULO_DO_PERFIL[usuario.perfil]}</td>
                    <td>
                      <span className={usuario.ativo ? 'selo selo-paga' : 'selo'}>{usuario.ativo ? 'Ativo' : 'Inativo'}</span>
                    </td>
                    <td>{usuario.ultimoAcessoEm ? formatarDataHora(usuario.ultimoAcessoEm) : '—'}</td>
                    <td className="acoes">
                      {ehVoce ? (
                        <span data-dica="Você não pode inativar o próprio acesso.">
                          <button type="button" className="botao botao-pequeno" disabled>
                            Inativar
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="botao botao-pequeno botao-fantasma" onClick={() => abrirDialogo(usuario)}>
                          <Icone nome="editar" />
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </EstadoDaConsulta>
      {dialogoAberto && (
        <DialogoUsuario
          aberto
          usuario={usuarioEmEdicao}
          aoFechar={() => definirDialogoAberto(false)}
        />
      )}
    </>
  )
}

export default AbaUsuarios
