import { createBrowserRouter } from 'react-router'
import PaginaLogin from '@/features/acesso/PaginaLogin'
import PaginaAluno from '@/features/cadastro/PaginaAluno'
import PaginaCadastros from '@/features/cadastro/PaginaCadastros'
import PaginaCobranca from '@/features/cobrancas/PaginaCobranca'
import PaginaCobrancas from '@/features/cobrancas/PaginaCobrancas'
import PaginaIndicadores from '@/features/indicadores/PaginaIndicadores'
import PaginaMovimentacoes from '@/features/movimentacoes/PaginaMovimentacoes'
import GuardaDiretoria from './GuardaDiretoria'
import LayoutProtegido from './LayoutProtegido'
import PaginaNaoEncontrada from './PaginaNaoEncontrada'

// Uma rota por tela do protótipo. As telas ficam dentro do layout autenticado.
// A guarda de diretoria melhora a navegacao; a API continua sendo a autoridade da permissao.
export const rotas = createBrowserRouter([
  { path: '/login', element: <PaginaLogin /> },
  {
    path: '/',
    element: <LayoutProtegido />,
    children: [
      { index: true, element: <PaginaIndicadores /> },
      { path: 'cadastros', element: <PaginaCadastros /> },
      { path: 'cadastros/alunos/:id', element: <PaginaAluno /> },
      { path: 'cobrancas', element: <PaginaCobrancas /> },
      { path: 'cobrancas/:id', element: <PaginaCobranca /> },
      { path: 'movimentacoes', element: <PaginaMovimentacoes /> },
      { path: 'administracao', element: <GuardaDiretoria /> },
      { path: '*', element: <PaginaNaoEncontrada /> },
    ],
  },
])
