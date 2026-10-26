import { useBuscarAmbienteDaIntegracao } from '@integracasd/api-client'

// Faixa no topo enquanto a integração estiver no ambiente de testes do Asaas. Aparece em todas as telas.
// [Administração.RF004]
function FaixaDeAmbiente() {
  const consulta = useBuscarAmbienteDaIntegracao()

  if (consulta.data?.ambiente !== 'SANDBOX') return null
  return (
    <div className="faixa-testes" role="status">
      Ambiente de testes do Asaas: as cobranças emitidas aqui não são reais.
    </div>
  )
}

export default FaixaDeAmbiente
