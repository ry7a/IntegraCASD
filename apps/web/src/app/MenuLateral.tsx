import { NavLink } from 'react-router'
import Icone, { type NomeDoIcone } from '@/compartilhado/componentes/Icone'
import { USUARIO_ATUAL } from '@/compartilhado/usuario-atual'

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
  return (
    <aside className="menu">
      <NavLink className="marca" to="/">
        <span className="marca-selo">CASD</span>
        <span className="marca-nome">IntegraCASD</span>
      </NavLink>
      <nav aria-label="Menu principal">
        {ITENS_DO_MENU.map((item) => (
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
        <strong>{USUARIO_ATUAL.nome}</strong>
        <span>{USUARIO_ATUAL.perfil}</span>
      </div>
    </aside>
  )
}

export default MenuLateral
