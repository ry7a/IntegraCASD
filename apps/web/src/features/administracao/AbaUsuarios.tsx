import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarDataHora } from '@/compartilhado/formatacao'
import { USUARIO_ATUAL } from '@/compartilhado/usuario-atual'
import { useListarUsuarios } from './consultas'
import type { PerfilUsuario } from './contrato'

const ROTULO_DO_PERFIL: Record<PerfilUsuario, string> = {
  DIRETORIA: 'Diretoria',
  ADMINISTRATIVO: 'Administrativo',
}

// Usuários e permissões. [Administração.RF001]
function AbaUsuarios() {
  const consulta = useListarUsuarios()
  const itens = consulta.data?.itens ?? []

  return (
    <>
      <div className="filtros">
        <p className="texto-apoio" style={{ margin: 0 }}>
          A diretoria tem todas as permissões do administrativo, mais esta área. Ao trocar de gestão, deixe ao menos um
          usuário de diretoria ativo.
        </p>
        <div className="campo" style={{ marginLeft: 'auto' }}>
          {/* TODO [Administração.RF001]: formulário de novo usuário. */}
          <button type="button" className="botao botao-principal">
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
                const ehVoce = usuario.email === USUARIO_ATUAL.email
                const secundario = ehVoce ? 'Você' : usuario.observacao
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
                        <button type="button" className="botao botao-pequeno botao-fantasma">
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
    </>
  )
}

export default AbaUsuarios
