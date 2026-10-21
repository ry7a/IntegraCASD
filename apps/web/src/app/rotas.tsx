import { createBrowserRouter, Navigate } from 'react-router'
import ListaDeAlunos from '@/features/cadastro/ListaDeAlunos'
import Layout from './Layout'

// Todas as telas ficam dentro do Layout (menu lateral). Enquanto a página de
// Indicadores não existe, a raiz leva direto à lista de alunos.
export const rotas = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/cadastros/alunos" replace /> },
      { path: 'cadastros/alunos', element: <ListaDeAlunos /> },
    ],
  },
])
