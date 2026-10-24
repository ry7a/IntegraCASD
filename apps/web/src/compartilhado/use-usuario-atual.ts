import { useContext } from 'react'
import { SessaoContexto } from './sessao-contexto'

export function useUsuarioAtual() {
  const usuario = useContext(SessaoContexto)
  if (!usuario) throw new Error('useUsuarioAtual deve ser usado dentro do layout autenticado.')
  return usuario
}
