import { useState } from 'react'
import { Link } from 'react-router'
import { useConsultarEvolucao, useConsultarResumoDosIndicadores } from '@integracasd/api-client'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarMes, formatarMoeda, formatarPercentual, hojeIso, nomeDoMes, somarMeses } from '@/compartilhado/formatacao'
import BlocoDeGastosPorCategoria from './BlocoDeGastosPorCategoria'
import BlocoDeInadimplencia from './BlocoDeInadimplencia'
import GraficoDeEntradasESaidas from './GraficoDeEntradasESaidas'

// Os últimos 12 meses, do corrente para trás ("AAAA-MM").
function ultimosMeses(): string[] {
  const atual = hojeIso().slice(0, 7)
  return Array.from({ length: 12 }, (_, atras) => somarMeses(atual, -atras))
}

// "+4,0% em relação a setembro", "−2,1% em relação a setembro" ou aviso de que não há base de comparação.
function textoDaVariacao(variacao: number | null, mes: string): string {
  const anterior = nomeDoMes(somarMeses(mes, -1))
  if (variacao === null) return `Sem movimento em ${anterior} para comparar`
  const sinal = variacao >= 0 ? '+' : '−'
  return `${sinal}${formatarPercentual(Math.abs(variacao))} em relação a ${anterior}`
}

// Cartão clicável: leva às movimentações que compõem o número (passo 5), sem cara de link.
// Sem `color` aqui: estilo inline vence qualquer classe, e apagaria o texto branco do cartão
// escuro (.indicador-destaque). A cor herdada dos outros cartões já vem da regra `a` do CSS.
const CARTAO_LINK = { display: 'block', textDecoration: 'none' }

// Página inicial. [Indicadores.RF001 a RF003]
function PaginaIndicadores() {
  const meses = ultimosMeses()
  const [mes, definirMes] = useState(meses[0])
  const resumo = useConsultarResumoDosIndicadores({ mes })
  const evolucao = useConsultarEvolucao({ ate: mes })
  const dados = resumo.data

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Indicadores</h1>
          <p>Posição financeira do CASD no período. [Indicadores.RF001]</p>
        </div>
        <div className="acoes">
          <div className="campo">
            <label htmlFor="periodo">Período de referência</label>
            <select id="periodo" value={mes} onChange={(evento) => definirMes(evento.target.value)}>
              {meses.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {formatarMes(opcao)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <EstadoDaConsulta carregando={resumo.isPending} erro={resumo.error} aoTentarDeNovo={() => void resumo.refetch()}>
        {dados && (
          <>
            {dados.vencidasSemSincronizar > 0 && (
              <div className="alerta" role="status">
                <Icone nome="alerta" />
                <p>
                  <strong>
                    {dados.vencidasSemSincronizar}{' '}
                    {dados.vencidasSemSincronizar === 1 ? 'cobrança vencida está' : 'cobranças vencidas estão'} há mais
                    de 7 dias sem sincronizar com o Asaas.
                  </strong>{' '}
                  O aluno pode ter pago e a notificação não ter chegado. Sincronize antes de cobrar.
                </p>
                <Link className="botao botao-pequeno" to="/cobrancas?situacoes=VENCIDA">
                  <Icone nome="sincronizar" />
                  Sincronizar agora
                </Link>
              </div>
            )}

            {/* Fluxo A1: mês sem movimentação mostra zeros e avisa, em vez de dar erro. */}
            {dados.semMovimentacao && (
              <p className="texto-apoio" role="status">
                Não há movimentações em {formatarMes(mes).toLowerCase()}.
              </p>
            )}

            <section className="grade grade-4" aria-label="Resumo do período">
              <Link className="cartao indicador" style={CARTAO_LINK} to={`/movimentacoes?mes=${mes}&tipo=ENTRADA`}>
                <div className="rotulo">Entradas</div>
                <div className="valor">{formatarMoeda(dados.entradasCentavos)}</div>
                <div className="detalhe">{textoDaVariacao(dados.variacaoEntradasPercentual, mes)}</div>
              </Link>
              <Link className="cartao indicador" style={CARTAO_LINK} to={`/movimentacoes?mes=${mes}&tipo=SAIDA`}>
                <div className="rotulo">Saídas</div>
                <div className="valor">{formatarMoeda(dados.saidasCentavos)}</div>
                <div className="detalhe">{textoDaVariacao(dados.variacaoSaidasPercentual, mes)}</div>
              </Link>
              <Link className="cartao indicador indicador-destaque" style={CARTAO_LINK} to={`/movimentacoes?mes=${mes}`}>
                <div className="rotulo">Resultado do período</div>
                <div className="valor">{formatarMoeda(dados.resultadoCentavos)}</div>
                <div className="detalhe">Entradas menos saídas de {nomeDoMes(mes)}</div>
              </Link>
              {/* Fluxo A2: o resultado não é dinheiro disponível; o que o Asaas ainda vai liberar fica à parte. */}
              <div className="cartao indicador">
                <div className="rotulo">Aguardando liberação do Asaas</div>
                <div className="valor">{formatarMoeda(dados.aguardandoLiberacaoCentavos)}</div>
                <div className="detalhe">Já pago pelos alunos, ainda não disponível em conta</div>
              </div>
            </section>
          </>
        )}
      </EstadoDaConsulta>

      <section className="grade grade-2-1">
        <div className="cartao">
          <div className="cartao-cabecalho">
            <div>
              <h2>Entradas e saídas</h2>
              <p>6 meses até {nomeDoMes(mes)}</p>
            </div>
            <div className="legenda" aria-hidden="true">
              <span>
                <i style={{ background: 'var(--serie-entradas)' }}></i>Entradas
              </span>
              <span>
                <i style={{ background: 'var(--serie-saidas)' }}></i>Saídas
              </span>
            </div>
          </div>
          <EstadoDaConsulta carregando={evolucao.isPending} erro={evolucao.error} aoTentarDeNovo={() => void evolucao.refetch()}>
            {evolucao.data && <GraficoDeEntradasESaidas meses={evolucao.data.meses} />}
          </EstadoDaConsulta>
        </div>

        <BlocoDeInadimplencia />
      </section>

      <BlocoDeGastosPorCategoria mes={mes} />
    </>
  )
}

export default PaginaIndicadores
