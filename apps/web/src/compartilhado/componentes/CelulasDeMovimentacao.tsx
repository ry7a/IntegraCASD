import type { MovimentacaoDto } from '@/compartilhado/dominio'
import Icone from './Icone'

// Células "Origem" e "Valor" das tabelas de movimentações (tela de Movimentações e aba do aluno).

export function CelulaDeOrigem({ movimentacao }: { movimentacao: MovimentacaoDto }) {
  const { origem, registradaPor } = movimentacao
  if (origem === 'CONCILIACAO_AUTOMATICA') return <>Conciliação automática</>
  if (origem === 'REGISTRO_MANUAL_DE_COBRANCA') {
    return (
      <span className="selo selo-manual">
        <Icone nome="editar" />
        Registro manual de cobrança
      </span>
    )
  }
  return (
    <>
      {origem === 'ESTORNO' ? 'Estorno' : 'Manual'}
      {registradaPor && <span className="secundario">{registradaPor}</span>}
    </>
  )
}
