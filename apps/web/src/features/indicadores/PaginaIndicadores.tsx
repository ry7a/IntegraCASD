import { Link } from 'react-router'
import EstadoDaConsulta from '@/compartilhado/componentes/EstadoDaConsulta'
import Icone from '@/compartilhado/componentes/Icone'
import { formatarMes, formatarMoeda, formatarPercentual, nomeDoMes, somarMeses } from '@/compartilhado/formatacao'
import BlocoDeGastosPorCategoria from './BlocoDeGastosPorCategoria'
import BlocoDeInadimplencia from './BlocoDeInadimplencia'
import { useEvolucaoDeEntradasESaidas, useResumoDosIndicadores } from './consultas'
import { MES_DOS_DADOS as mes } from './dados-ficticios'
import GraficoDeEntradasESaidas from './GraficoDeEntradasESaidas'

// "+4,0% em relação a setembro", "−2,1% em relação a setembro" ou aviso de que não há base de comparação.
function textoDaVariacao(variacao: number | null): string {
  const anterior = nomeDoMes(somarMeses(mes, -1))
  if (variacao === null) return `Sem movimento em ${anterior} para comparar`
  const sinal = variacao >= 0 ? '+' : '−'
  return `${sinal}${formatarPercentual(Math.abs(variacao))} em relação a ${anterior}`
}

// Página inicial. [Indicadores.RF001 a RF003]
function PaginaIndicadores() {
  const resumo = useResumoDosIndicadores()
  const evolucao = useEvolucaoDeEntradasESaidas()
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
            {/* TODO [Indicadores.RF001]: escolher outros meses e "Últimos 12 meses" quando a API aceitar o período. */}
            <select id="periodo" value={mes} disabled>
              <option value={mes}>{formatarMes(mes)}</option>
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
                <Link className="botao botao-pequeno" to="/cobrancas">
                  <Icone nome="sincronizar" />
                  Sincronizar agora
                </Link>
              </div>
            )}

            <section className="grade grade-4" aria-label="Resumo do período">
              <div className="cartao indicador">
                <div className="rotulo">Entradas</div>
                <div className="valor">{formatarMoeda(dados.entradasCentavos)}</div>
                <div className="detalhe">{textoDaVariacao(dados.variacaoEntradasPercentual)}</div>
              </div>
              <div className="cartao indicador">
                <div className="rotulo">Saídas</div>
                <div className="valor">{formatarMoeda(dados.saidasCentavos)}</div>
                <div className="detalhe">{textoDaVariacao(dados.variacaoSaidasPercentual)}</div>
              </div>
              <div className="cartao indicador indicador-destaque">
                <div className="rotulo">Resultado do período</div>
                <div className="valor">{formatarMoeda(dados.resultadoCentavos)}</div>
                <div className="detalhe">Entradas menos saídas de {nomeDoMes(mes)}</div>
              </div>
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
              <p>Últimos 6 meses</p>
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
