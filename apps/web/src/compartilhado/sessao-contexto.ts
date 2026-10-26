import { createContext } from 'react'
import type { UsuarioDaSessaoDto } from '@integracasd/api-client'

export const SessaoContexto = createContext<UsuarioDaSessaoDto | null>(null)
