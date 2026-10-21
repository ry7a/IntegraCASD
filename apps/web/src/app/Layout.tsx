import { NavLink, Outlet } from 'react-router'
import { cn } from '@/compartilhado/utils'

// Itens do menu lateral. Cada área entra aqui quando a tela dela existir.
const itensDoMenu = [{ para: '/cadastros/alunos', rotulo: 'Cadastros' }]

function Layout() {
  return (
    <div className="flex min-h-screen">
      <nav aria-label="Menu principal" className="w-56 shrink-0 bg-sidebar p-4 text-sidebar-foreground">
        <p className="mb-6 font-heading text-lg font-bold">IntegraCASD</p>
        <ul className="space-y-1 text-sm">
          {itensDoMenu.map((item) => (
            <li key={item.para}>
              {/* O NavLink marca o item da página atual com aria-current="page" e isActive. */}
              <NavLink
                to={item.para}
                className={({ isActive }) =>
                  cn(
                    'block rounded-md px-3 py-2 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
                    isActive
                      ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground'
                      : 'hover:bg-sidebar-accent',
                  )
                }
              >
                {item.rotulo}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="min-w-0 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
