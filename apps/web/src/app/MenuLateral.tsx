import { getBuscarSessaoQueryKey, useSair } from '@integracasd/api-client'
import { useQueryClient } from '@tanstack/react-query'
import { NavLink, useNavigate } from 'react-router'
import Icone, { type NomeDoIcone } from '@/compartilhado/componentes/Icone'
import { useUsuarioAtual } from '@/compartilhado/use-usuario-atual'

interface ItemDoMenu {
  icone: NomeDoIcone
  titulo: string
  rota: string
  etiqueta?: string
}

const ITENS_DO_MENU: ItemDoMenu[] = [
  { icone: 'indicadores', titulo: 'Indicadores', rota: '/' },
  { icone: 'cadastros', titulo: 'Cadastros', rota: '/cadastros' },
  { icone: 'cobrancas', titulo: 'Cobranças', rota: '/cobrancas' },
  { icone: 'movimentacoes', titulo: 'Movimentações', rota: '/movimentacoes' },
  { icone: 'administracao', titulo: 'Administração', rota: '/administracao', etiqueta: 'Diretoria' },
]

function MenuLateral() {
  const usuario = useUsuarioAtual()
  const sair = useSair()
  const queryClient = useQueryClient()
  const navegar = useNavigate()

  async function encerrarSessao() {
    try {
      await sair.mutateAsync()
    } finally {
      queryClient.removeQueries({ queryKey: getBuscarSessaoQueryKey() })
      navegar('/login', { replace: true })
    }
  }

  return (
    <aside className="menu">
      <NavLink className="marca" to="/">
        <span className="marca-selo">CASD</span>
        <span className="marca-nome">IntegraCASD</span>
      </NavLink>
      <nav aria-label="Menu principal">
        {ITENS_DO_MENU.filter((item) => item.rota !== '/administracao' || usuario.perfil === 'DIRETORIA').map((item) => (
          // O NavLink coloca aria-current="page" no item da tela aberta; o CSS pinta o item ativo.
          // "end" no início evita que "/" fique ativo em todas as telas.
          <NavLink key={item.rota} className="menu-item" to={item.rota} end={item.rota === '/'}>
            <Icone nome={item.icone} />
            {item.titulo}
            {item.etiqueta && <span className="etiqueta">{item.etiqueta}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="menu-usuario">
        <strong>{usuario.nome}</strong>
        <span>{usuario.perfil === 'DIRETORIA' ? 'Diretoria' : 'Administrativo'}</span>
        <button type="button" className="menu-sair" onClick={() => void encerrarSessao()} disabled={sair.isPending}>
          Sair
        </button>
      </div>
    </aside>
  )
}

export default MenuLateral
