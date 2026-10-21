import type { SituacaoCobranca } from '@/compartilhado/dominio'
import Icone from './Icone'

// Selo de situação da cobrança. Sempre com texto (nunca só cor) e, quando ajuda, com ícone.
function SeloDaCobranca({ situacao }: { situacao: SituacaoCobranca }) {
  switch (situacao) {
    case 'ABERTA':
      return <span className="selo selo-aberta">Aberta</span>
    case 'VENCIDA':
      return (
        <span className="selo selo-vencida">
          <Icone nome="relogio" />
          Vencida
        </span>
      )
    case 'PAGA':
      return (
        <span className="selo selo-paga">
          <Icone nome="check" />
          Paga
        </span>
      )
    case 'PAGA_COM_REGISTRO_MANUAL':
      return (
        <span className="selo selo-manual">
          <Icone nome="editar" />
          Paga com registro manual
        </span>
      )
    case 'CANCELADA':
      return <span className="selo">Cancelada</span>
    case 'ESTORNADA':
      return (
        <span className="selo">
          <Icone nome="estornar" />
          Estornada
        </span>
      )
  }
}

export default SeloDaCobranca
