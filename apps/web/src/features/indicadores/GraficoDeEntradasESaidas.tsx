import { abreviarMes, formatarMes, formatarMoeda } from '@/compartilhado/formatacao'
import type { PontoDeEvolucaoDto } from '@integracasd/api-client'

// Gráfico de barras agrupadas em SVG puro (sem biblioteca), como no protótipo.
// Os dados também aparecem em tabela, para quem não enxerga o gráfico.

const LARGURA = 640
const ALTURA = 360
const ESQUERDA = 64
const DIREITA = 624
const TOPO = 16
const BASE = 324
const LARGURA_DA_BARRA = 26
const ESPACO = 2
// Passos possíveis entre as linhas de grade, em reais. Usa o menor que deixa no máximo 5 linhas.
const PASSOS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000]

// Barra com cantos arredondados só no topo, presa à linha de base.
function caminhoDaBarra(x: number, topoDaBarra: number): string {
  const raio = 4
  const direita = x + LARGURA_DA_BARRA
  return `M${x},${BASE} V${topoDaBarra + raio} Q${x},${topoDaBarra} ${x + raio},${topoDaBarra} H${direita - raio} Q${direita},${topoDaBarra} ${direita},${topoDaBarra + raio} V${BASE} Z`
}

interface BarraProps {
  x: number
  topoDaBarra: number
  cor: string
  dica: string
}

function Barra({ x, topoDaBarra, cor, dica }: BarraProps) {
  return (
    <g className="barra" data-dica={dica}>
      {/* Retângulo invisível: aumenta a área onde a dica aparece. */}
      <rect x={x - 2} y={TOPO} width={LARGURA_DA_BARRA + 4} height={BASE - TOPO} fill="transparent" />
      <path d={caminhoDaBarra(x, topoDaBarra)} fill={cor} />
    </g>
  )
}
function GraficoDeEntradasESaidas({ meses }: { meses: PontoDeEvolucaoDto[] }) {
  // A API manda centavos; o gráfico trabalha em reais. A escala vai até o próximo múltiplo do passo.
  const maiorValor = Math.max(1, ...meses.flatMap((m) => [m.entradasCentavos, m.saidasCentavos])) / 100
  const passo = PASSOS.find((candidato) => maiorValor / candidato <= 5) ?? PASSOS[PASSOS.length - 1]
  const maximo = Math.ceil(maiorValor / passo) * passo

  const y = (reais: number) => BASE - (reais / maximo) * (BASE - TOPO)
  const larguraDoGrupo = (DIREITA - ESQUERDA) / meses.length

  const marcas: number[] = []
  for (let marca = 0; marca < maximo; marca += passo) marcas.push(marca)

  return (
    <>
      <div className="grafico" id="grafico-evolucao">
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          role="img"
          aria-label={`Entradas e saídas dos últimos ${meses.length} meses. Os valores estão na tabela abaixo do gráfico.`}
        >
          {marcas.map((marca) => (
            <g key={marca}>
              <line className="grade-linha" x1={ESQUERDA} x2={DIREITA} y1={y(marca)} y2={y(marca)} />
              <text x={ESQUERDA - 8} y={y(marca) + 4} textAnchor="end">
                {marca === 0 ? 'R$ 0' : marca % 1000 === 0 ? `R$ ${marca / 1000} mil` : formatarMoeda(marca * 100)}
              </text>
            </g>
          ))}
          {meses.map((ponto, i) => {
            const centro = ESQUERDA + larguraDoGrupo * (i + 0.5)
            const nome = formatarMes(ponto.mes)
            return (
              <g key={ponto.mes}>
                <Barra
                  x={centro - LARGURA_DA_BARRA - ESPACO / 2}
                  topoDaBarra={y(ponto.entradasCentavos / 100)}
                  cor="var(--serie-entradas)"
                  dica={`${nome} · Entradas: ${formatarMoeda(ponto.entradasCentavos)}`}
                />
                <Barra
                  x={centro + ESPACO / 2}
                  topoDaBarra={y(ponto.saidasCentavos / 100)}
                  cor="var(--serie-saidas)"
                  dica={`${nome} · Saídas: ${formatarMoeda(ponto.saidasCentavos)}`}
                />
                <text x={centro} y={BASE + 20} textAnchor="middle">
                  {abreviarMes(ponto.mes)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <details className="ver-tabela">
        <summary>Ver os dados em tabela</summary>
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th className="numero">Entradas</th>
              <th className="numero">Saídas</th>
              <th className="numero">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((ponto) => (
              <tr key={ponto.mes}>
                <td>{formatarMes(ponto.mes).replace(/ de \d+$/, '')}</td>
                <td className="numero">{formatarMoeda(ponto.entradasCentavos)}</td>
                <td className="numero">{formatarMoeda(ponto.saidasCentavos)}</td>
                <td className="numero">{formatarMoeda(ponto.resultadoCentavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  )
}

export default GraficoDeEntradasESaidas
