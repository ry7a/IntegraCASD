import { useSearchParams } from 'react-router'

// A aba aberta fica na URL (?aba=contratos): o link para uma aba específica funciona e o botão
// "voltar" do navegador também.
export function useAbaDaUrl<T extends string>(abasValidas: readonly T[], padrao: T) {
  const [parametros, definirParametros] = useSearchParams()
  const pedida = parametros.get('aba')
  const aba = abasValidas.find((valida) => valida === pedida) ?? padrao

  function mudarAba(nova: T) {
    // replace: trocar de aba não cria uma entrada nova no histórico.
    definirParametros({ aba: nova }, { replace: true })
  }
  return [aba, mudarAba] as const
}
