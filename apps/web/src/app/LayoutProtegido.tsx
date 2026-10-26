import { useBuscarSessao } from '@integracasd/api-client'
import { Navigate } from 'react-router'
import { SessaoContexto } from '@/compartilhado/sessao-contexto'
import Layout from './Layout'

function LayoutProtegido() {
  const sessao = useBuscarSessao({ query: { retry: false } })

  if (sessao.isPending) return <div className="tela-carregando">Verificando acesso...</div>
  if (sessao.isError) return <Navigate to="/login" replace />

  return (
    <SessaoContexto.Provider value={sessao.data}>
      <Layout />
    </SessaoContexto.Provider>
  )
}

export default LayoutProtegido
