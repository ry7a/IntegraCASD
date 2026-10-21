import { useBuscarIntegracaoComOAsaas } from '@/features/administracao/consultas'

// Faixa no topo enquanto a integração estiver no ambiente de testes do Asaas. Aparece em todas as telas.
function FaixaDeAmbiente() {
  // TODO [Administração.RF004]: quando existir um endpoint só do ambiente, trocar por ele.
  const integracao = useBuscarIntegracaoComOAsaas()

  if (integracao.data?.ambiente !== 'SANDBOX') return null
  return (
    <div className="faixa-testes" role="status">
      Ambiente de testes do Asaas: as cobranças emitidas aqui não são reais.
    </div>
  )
}

export default FaixaDeAmbiente
