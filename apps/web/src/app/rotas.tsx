import { createBrowserRouter } from 'react-router'
import PaginaAdministracao from '@/features/administracao/PaginaAdministracao'
import PaginaAluno from '@/features/cadastro/PaginaAluno'
import PaginaCadastros from '@/features/cadastro/PaginaCadastros'
import PaginaCobranca from '@/features/cobrancas/PaginaCobranca'
import PaginaCobrancas from '@/features/cobrancas/PaginaCobrancas'
import PaginaIndicadores from '@/features/indicadores/PaginaIndicadores'
import PaginaMovimentacoes from '@/features/movimentacoes/PaginaMovimentacoes'
import Layout from './Layout'
import PaginaNaoEncontrada from './PaginaNaoEncontrada'

// Uma rota por tela do protótipo. As telas ficam dentro do Layout (menu lateral + barra do topo).
// TODO [Segurança]: a guarda de perfil esconderá /administracao de quem não é da diretoria
// (a permissão de verdade é verificada na API).
export const rotas = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <PaginaIndicadores /> },
      { path: 'cadastros', element: <PaginaCadastros /> },
      { path: 'cadastros/alunos/:id', element: <PaginaAluno /> },
      { path: 'cobrancas', element: <PaginaCobrancas /> },
      { path: 'cobrancas/:id', element: <PaginaCobranca /> },
      { path: 'movimentacoes', element: <PaginaMovimentacoes /> },
      { path: 'administracao', element: <PaginaAdministracao /> },
      { path: '*', element: <PaginaNaoEncontrada /> },
    ],
  },
])
