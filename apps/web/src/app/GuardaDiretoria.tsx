import { Navigate } from 'react-router'
import { useUsuarioAtual } from '@/compartilhado/use-usuario-atual'
import PaginaAdministracao from '@/features/administracao/PaginaAdministracao'

function GuardaDiretoria() {
  const usuario = useUsuarioAtual()
  return usuario.perfil === 'DIRETORIA' ? <PaginaAdministracao /> : <Navigate to="/" replace />
}

export default GuardaDiretoria
