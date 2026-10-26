import { useState } from 'react'
import { Link } from 'react-router'
import { useConsultarGastosPorCategoria } from '@integracasd/api-client'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import { formatarMes, formatarMoeda, formatarPercentual, nomeDoMes, somarMeses } from '@/compartilhado/formatacao'

// "+12,5%", "−3,0%" ou "novo" quando não houve gasto na categoria no mês anterior.
function textoDaVariacao(variacao: number | null): string {
  if (variacao === null) return 'novo'
  return `${variacao >= 0 ? '+' : '−'}${formatarPercentual(Math.abs(variacao))}`
}

// [Indicadores.RF003] Saídas do mês por categoria, da maior para a menor.
function BlocoDeGastosPorCategoria({ mes }: { mes: string }) {
  const consulta = useConsultarGastosPorCategoria({ mes })
  const [comparar, definirComparar] = useState(false)
  const dados = consulta.data
  const itens = (dados?.itens ?? []).filter((gasto) => comparar || gasto.valorCentavos > 0)
  const maior = Math.max(1, ...itens.map((gasto) => Math.max(gasto.valorCentavos, comparar ? gasto.valorMesAnteriorCentavos : 0)))
  const anterior = nomeDoMes(somarMeses(mes, -1))

  return (
    <section className="cartao">
      <div className="cartao-cabecalho">
        <div>
          <h2>Gastos por categoria</h2>
          <p>
            Saídas de {formatarMes(mes).toLowerCase()}, ordenadas por valor. Clique em uma categoria para ver as
            movimentações. [Indicadores.RF003]
          </p>
        </div>
        <label className="campo-check">
          <input type="checkbox" checked={comparar} onChange={(evento) => definirComparar(evento.target.checked)} />
          Comparar com {anterior}
        </label>
      </div>
      <EstadoDaConsulta
        carregando={consulta.isPending}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        vazio={itens.length === 0}
        mensagemVazia="Nenhuma saída registrada neste mês."
      >
        {comparar && dados && (
          <p className="texto-apoio" style={{ marginTop: 0 }}>
            Total de saídas: {formatarMoeda(dados.totalSaidasCentavos)} em {nomeDoMes(mes)} e{' '}
            {formatarMoeda(dados.totalMesAnteriorCentavos)} em {anterior}.
          </p>
        )}
        <ul className="lista-barras">
          {itens.map((gasto) => {
            const dica = `${gasto.categoriaNome}: ${formatarMoeda(gasto.valorCentavos)} (${formatarPercentual(gasto.percentual)} das saídas)${
              comparar ? `; ${formatarMoeda(gasto.valorMesAnteriorCentavos)} em ${anterior}` : ''
            }`
            return (
              <li key={gasto.categoriaId}>
                <span>
                  <Link to={`/movimentacoes?mes=${mes}&categoriaId=${gasto.categoriaId}`}>{gasto.categoriaNome}</Link>
                </span>
                <div className="trilho" data-dica={dica}>
                  <div className="preenchimento" style={{ width: `${(gasto.valorCentavos / maior) * 100}%` }}></div>
                </div>
                <span className="valor-barra">
                  {formatarMoeda(gasto.valorCentavos)}
                  <span>
                    {formatarPercentual(gasto.percentual)}
                    {comparar && ` · ${textoDaVariacao(gasto.variacaoPercentual)}`}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </EstadoDaConsulta>
    </section>
  )
}

export default BlocoDeGastosPorCategoria
