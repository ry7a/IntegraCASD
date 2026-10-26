import { createContext, useContext } from 'react'

// Ações da barra do topo que qualquer tela pode disparar (ex.: "Nova cobrança" na tela do aluno,
// já com o aluno preenchido). Os diálogos moram em app/; as features só chamam estas funções.
// O que já vem preenchido na nova cobrança. Na renegociação [Cobranças.RF004], vêm os dados da
// cobrança cancelada e o vínculo com ela.
export interface NovaCobrancaPreenchida {
  aluno?: string
  valor?: string
  descricao?: string
  renegociacaoDeId?: string
}

export interface AcoesGlobais {
  abrirNovaCobranca: (preenchida?: NovaCobrancaPreenchida) => void
  abrirNovaMovimentacao: () => void
}

export const AcoesGlobaisContexto = createContext<AcoesGlobais | null>(null)

export function useAcoesGlobais(): AcoesGlobais {
  const acoes = useContext(AcoesGlobaisContexto)
  if (!acoes) throw new Error('useAcoesGlobais precisa estar dentro do Layout.')
  return acoes
}
