import { Link } from 'react-router'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarMes, formatarMoeda, formatarPercentual, nomeDoMes } from '@/compartilhado/formatacao'
import { useGastosPorCategoria } from './consultas'

// [Indicadores.RF003] Saídas do mês por categoria, da maior para a menor.
function BlocoDeGastosPorCategoria({ mes }: { mes: string }) {
  const consulta = useGastosPorCategoria()
  const dados = consulta.data
  const maior = dados?.itens[0]?.valorCentavos ?? 1

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
        {/* TODO [Indicadores.RF003]: comparar com o mês anterior (a API ainda não devolve o comparativo). */}
        <label className="campo-check" data-dica={`Comparar com ${nomeDoMes(mes)} ainda não está disponível`}>
          <input type="checkbox" disabled />
          Comparar com o mês anterior
        </label>
      </div>
      <EstadoDaConsulta
        carregando={consulta.isPending}
        erro={consulta.error}
        aoTentarDeNovo={() => void consulta.refetch()}
        vazio={dados?.itens.length === 0}
        mensagemVazia="Nenhuma saída registrada neste mês."
      >
        <ul className="lista-barras">
          {dados?.itens.map((gasto) => {
            const nome = gasto.categoriaNome ?? 'Não classificadas'
            const dica = `${nome}: ${formatarMoeda(gasto.valorCentavos)} (${formatarPercentual(gasto.percentual)} das saídas)${
              gasto.categoriaId ? '' : '. Classifique essas movimentações.'
            }`
            return (
              <li key={gasto.categoriaId ?? 'sem-categoria'}>
                <span>
                  {gasto.categoriaId ? (
                    <Link to={`/movimentacoes?mes=${mes}&categoriaId=${gasto.categoriaId}`}>{nome}</Link>
                  ) : (
                    <span className="selo selo-alerta">
                      <Icone nome="alerta" />
                      {nome}
                    </span>
                  )}
                </span>
                <div className="trilho" data-dica={dica}>
                  <div className="preenchimento" style={{ width: `${(gasto.valorCentavos / maior) * 100}%` }}></div>
                </div>
                <span className="valor-barra">
                  {formatarMoeda(gasto.valorCentavos)}
                  <span>{formatarPercentual(gasto.percentual)}</span>
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
